'''
The multi-event reports API, under `organizations/<organization_id>/multi-event/`
(SPEC §5, §8.12). Any role reads; Registrars and Admins change what's included,
link and unlink people, and dismiss suggestions (the default RolePermission).
'''

from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from camphoric import models
from camphoric.multi_event import matching, people, stats


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
