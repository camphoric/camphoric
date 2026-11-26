'''
Multi-event report templates (SPEC §8.12, DR-181): the variables an
organization's report sees, and rendering one.

Each included event in scope brings its own variable graph, as its event reports
see it (SPEC §9.3), so a template can read anything an event report can; the
figures across events (people, new, returning, came back, received) and the
people are the Stats section's (stats.py). The names and types must match
`registry.ORGANIZATION_CONTEXTS` and `ORGANIZATION_TYPES` (a test checks).
'''

from decimal import Decimal

from django.utils import timezone

from camphoric.multi_event import people, stats
from camphoric.templating.graph import build_event_graph, template_timezone
from camphoric.templating.render import REPORT_LIMITS, render_template, report_format
from camphoric.templating.values import (
    IncludedEventVar, PersonRecordVar, PersonVar, ReadOnlyList)


def report_context(organization, series=None, *, request=None):
    figures = stats.stats(organization, series=series)
    events = [e for e in people.included_events(organization)
              if series is None or e.multi_event.series == series]
    graphs = {event.id: build_event_graph(event, request=request) for event in events}

    included = {}
    for row in figures['events']:
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
            previous=included[previous['event']] if previous else None,
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
        everyone.append(PersonVar(
            id=row['key'],
            name=row['name'],
            linked=row['person'] is not None,
            records=records,
            campers=ReadOnlyList(r['camper'] for r in records),
            events=ReadOnlyList(included[e] for e in row['events']),
            attended=row['attended'],
            first_event=included[row['first_event']],
            last_event=included[row['last_event']],
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
    '''Render a multi-event report template for every included event, or one series.'''
    return render_template(template, report_context(organization, series, request=request),
                           fmt=report_format(output), limits=limits)
