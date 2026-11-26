'''
The multi-event reports API, under `organizations/<organization_id>/multi-event/`
(SPEC §5, §8.12). Any role reads; Registrars and Admins change what's included,
link and unlink people, and dismiss suggestions (the default RolePermission).
Rendering a multi-event report (`organization-reports/<id>/render`) and previewing
a template read, so any role may.
'''

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from camphoric import models
from camphoric.multi_event import matching, people, reports, stats
from camphoric.templating.describe import describe_organization
from camphoric.templating.render import PREVIEW_LIMITS


class OrganizationMixin:
    def organization(self):
        return get_object_or_404(models.Organization, pk=self.kwargs['organization_id'])


class EventsView(OrganizationMixin, APIView):
    '''GET: the organization's events in the event chooser's order, each included or not.'''

    def get(self, request, organization_id):
        return Response([people.event_row(e) for e in people.ordered_events(self.organization())])


class InclusionSerializer(serializers.Serializer):
    included = serializers.BooleanField(required=False)
    series = serializers.CharField(required=False, allow_blank=True, max_length=100)


class EventView(OrganizationMixin, APIView):
    '''PATCH `{included?, series?}`: include or leave out one event, or set its series.'''

    def patch(self, request, organization_id, event_id):
        event = get_object_or_404(
            models.Event.objects.select_related('multi_event'),
            pk=event_id, organization=self.organization())
        data = InclusionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(people.set_inclusion(event, **data.validated_data))


class CampersView(OrganizationMixin, APIView):
    '''GET: the live camper records of the included events, with the person each is linked to.'''

    def get(self, request, organization_id):
        return Response([r.as_dict() for r in people.records(self.organization())])


class SuggestionsView(OrganizationMixin, APIView):
    '''GET: the suggested matches, strongest first (DR-178).'''

    def get(self, request, organization_id):
        return Response(matching.suggestions(self.organization()))


class CampersSerializer(serializers.Serializer):
    campers = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class LinkView(OrganizationMixin, APIView):
    '''POST `{campers}`: link these camper records, and their people, as one person.'''

    def post(self, request, organization_id):
        data = CampersSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        person = people.link(self.organization(), data.validated_data['campers'])
        return Response({
            'person': person.id,
            'campers': list(models.Camper.objects.filter(person=person)
                            .order_by('id').values_list('id', flat=True)),
        })


class UnlinkView(OrganizationMixin, APIView):
    '''
    POST `{campers}`: take records out of their person; two or more are split off
    as a person of their own. Answers `{person}`: that person, or null for one record.
    '''

    def post(self, request, organization_id):
        data = CampersSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        split = people.unlink(self.organization(), data.validated_data['campers'])
        return Response({'person': split.id if split else None})


class DismissView(OrganizationMixin, APIView):
    '''POST `{campers}`: these camper records aren't one person; don't suggest them again.'''

    def post(self, request, organization_id):
        data = CampersSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if len(set(data.validated_data['campers'])) < 2:
            raise serializers.ValidationError({'campers': 'Choose at least two camper records.'})
        people.dismiss(self.organization(), data.validated_data['campers'])
        return Response(status=204)


class StatsView(OrganizationMixin, APIView):
    '''GET `?series=`: attendance and retention across the included events, or one series'.'''

    def get(self, request, organization_id):
        series = request.query_params.get('series')
        return Response(stats.stats(self.organization(), series=series or None))


def _body(request):
    '''The request's JSON object; anything else reads as an empty one, as the event preview's.'''
    return request.data if isinstance(request.data, dict) else {}


def _series(data):
    series = data.get('series')
    if series is not None and not isinstance(series, str):
        raise serializers.ValidationError({'series': 'A series is a name.'})
    return series or None


class RenderReportView(APIView):
    '''
    POST `{series?}` to `organization-reports/<id>/render`: render a multi-event
    report for every included event, or one series. `{report, error, diagnostics}`,
    as an event report's render (DR-181). Rendering reads; a Reporter may render.
    '''
    read_only_methods = ('POST',)

    def post(self, request, organization_report_id):
        report = get_object_or_404(models.OrganizationReport, pk=organization_report_id)
        result = reports.render(report.organization, report.template, report.output,
                                _series(_body(request)), request=request)
        return Response({
            'report': result.output if result.ok else '',
            'error': result.error,
            'diagnostics': [d.as_dict() for d in result.diagnostics],
        })


class TemplateDescribeView(OrganizationMixin, APIView):
    '''GET: the variables, filters and tags multi-event report templates have (SPEC §9.3).'''

    def get(self, request, organization_id):
        self.organization()
        return Response(describe_organization())


class TemplatePreviewView(OrganizationMixin, APIView):
    '''
    POST `{template, output, series?}`: render an unsaved multi-event report
    template, as the template preview does for an event's (SPEC §9.3).
    '''
    read_only_methods = ('POST',)

    def post(self, request, organization_id):
        organization = self.organization()
        data = _body(request)
        template = data.get('template')
        output = data.get('output')
        if not isinstance(template, str):
            return Response({'detail': 'template must be text'},
                            status=status.HTTP_400_BAD_REQUEST)
        if output not in ('csv', 'md', 'txt', 'html'):
            return Response({'detail': 'output must be one of csv, md, txt, html'},
                            status=status.HTTP_400_BAD_REQUEST)
        result = reports.render(organization, template, output, _series(data),
                                request=request, limits=PREVIEW_LIMITS)
        return Response({**result.as_dict(), 'sample': None})
