'''
Multi-event report templates (SPEC §8.12, DR-181): the variables an
organization's report sees, and rendering one.

Each included event in scope brings its own variable graph, as its event reports
see it (SPEC §9.3), so a template can read anything an event report can; the
figures across events (people, new, returning, came back, received) and the
people are the Stats section's (stats.py). The names and types must match
`registry.ORGANIZATION_CONTEXTS` and `ORGANIZATION_TYPES` (a test checks).
'''

import dataclasses
from decimal import Decimal
import time

from django.utils import timezone

from camphoric import models
from camphoric.multi_event import stats
from camphoric.templating.graph import build_event_graph, template_timezone
from camphoric.templating.render import (
    REPORT_LIMITS, Diagnostic, RenderResult, render_template, report_format)
from camphoric.templating.values import (
    IncludedEventVar, PersonRecordVar, PersonVar, ReadOnlyList)


class ContextTimeout(Exception):
    '''Building the events' variables took longer than the render may.'''


def report_context(organization, series=None, *, request=None, deadline=None):
    '''
    The variables, for every included event or one series. With a `deadline`
    (a `time.monotonic()` value), building stops with ContextTimeout once it's
    passed, checked after each event's graph.
    '''
    figures = stats.stats(organization, series=series)
    # The events the stats counted, read once: one taken out meanwhile stays in.
    events = models.Event.objects.select_related('organization').in_bulk(
        [row['event'] for row in figures['events']])
    rows = [row for row in figures['events'] if row['event'] in events]
    graphs = {}
    for row in rows:
        graphs[row['event']] = build_event_graph(events[row['event']], request=request)
        if deadline is not None and time.monotonic() > deadline:
            raise ContextTimeout

    included = {}
    for row in rows:
        graph = graphs[row['event']]
        previous = row['previous']
        included[row['event']] = IncludedEventVar(
            id=row['event'],
            name=row['name'],
            series=row['series'],
            date=row['date'],
            year=row['year'],
            event=graph.event,
            registrations=graph.registrations,
            campers=graph.campers,
            payments=graph.payments,
            invoices=graph.invoices,
            people=row['people'],
            new=row['new'],
            returning=row['returning'],
            previous=included.get(previous['event']) if previous else None,
            came_back=previous['returned'] if previous else None,
            received=Decimal(row['received']),
        )

    camper_event = {camper['id']: (event_id, camper)
                    for event_id, graph in graphs.items() for camper in graph.campers}
    everyone = ReadOnlyList()
    for row in figures['people']:
        records = ReadOnlyList(
            PersonRecordVar(id=camper_id, event=included[camper_event[camper_id][0]],
                            camper=camper_event[camper_id][1])
            for camper_id in row['campers'] if camper_id in camper_event)
        attended = ReadOnlyList(included[e] for e in row['events'] if e in included)
        if not attended:
            continue  # only at an event gone since the stats were counted
        everyone.append(PersonVar(
            id=row['key'],
            name=row['name'],
            linked=row['person'] is not None,
            records=records,
            campers=ReadOnlyList(r['camper'] for r in records),
            events=attended,
            attended=len(attended),
            first_event=attended[0],
            last_event=attended[-1],
            longest_run=row['longest_run'],
        ))

    now = timezone.localtime(timezone.now(), template_timezone())
    return {
        'organization_name': organization.name,
        'series': series or '',
        'events': ReadOnlyList(included.values()),
        'people': everyone,
        'today': now.date(),
        'now': now,
    }


def render(organization, template, output, series=None, *, request=None, limits=REPORT_LIMITS):
    '''
    Render a multi-event report template for every included event, or one
    series. Building the variables and rendering share the time limit (DR-111).
    '''
    started = time.monotonic()
    try:
        context = report_context(organization, series, request=request,
                                 deadline=started + limits.timeout_s)
    except ContextTimeout:
        return RenderResult(output='', diagnostics=[Diagnostic(
            'error', 'timeout', f'Gathering the events\' data took longer than '
            f'{limits.timeout_s:g} seconds. Try one series.')],
            duration_ms=int((time.monotonic() - started) * 1000))
    remaining = max(limits.timeout_s - (time.monotonic() - started), 0.1)
    return render_template(template, context, fmt=report_format(output),
                           limits=dataclasses.replace(limits, timeout_s=remaining))
