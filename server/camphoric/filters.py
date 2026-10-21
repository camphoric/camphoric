'''
Filtering the admin API's lists (django-filter). Every list of records that
belong to an event filters by it as `event`, however far away the event is,
and a list answers 400 to a query parameter it doesn't know, so a misspelled
or missing filter fails loudly instead of returning every row (#935).
'''

import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.exceptions import ValidationError
from rest_framework.settings import api_settings

from camphoric import models

PAGINATION_PARAMS = (
    'page_query_param', 'page_size_query_param', 'limit_query_param', 'offset_query_param',
    'cursor_query_param',
)


class StrictFilterBackend(DjangoFilterBackend):
    '''
    DjangoFilterBackend, except that a list refuses a query parameter that is
    none of its filters, its paginator's, `format`, or one the view reads
    itself (its `extra_query_params`).
    '''

    def filter_queryset(self, request, queryset, view):
        if getattr(view, 'action', 'list') == 'list':
            self.check_query_params(request, queryset, view)
        return super().filter_queryset(request, queryset, view)

    def check_query_params(self, request, queryset, view):
        filterset_class = self.get_filterset_class(view, queryset)
        filters = set(filterset_class.base_filters) if filterset_class else set()
        allowed = filters | set(getattr(view, 'extra_query_params', ())) | {
            api_settings.URL_FORMAT_OVERRIDE}
        paginator = getattr(view, 'paginator', None)
        allowed |= {getattr(paginator, param, None) for param in PAGINATION_PARAMS}
        unknown = sorted(set(request.query_params) - allowed)
        if unknown:
            known = ', '.join(sorted(filters)) or 'nothing'
            raise ValidationError({
                param: [f'This list doesn\'t filter by "{param}". It filters by {known}.']
                for param in unknown})


def event_filter(path):
    '''A filter by the event at `path`, to offer as `event`.'''
    return django_filters.ModelChoiceFilter(
        field_name=path, queryset=models.Event.objects.all())


class InvitationFilter(django_filters.FilterSet):
    event = event_filter('registration_type__event')

    class Meta:
        model = models.Invitation
        fields = ['registration', 'registration_type', 'registration_type__event']


class CamperFilter(django_filters.FilterSet):
    event = event_filter('registration__event')

    class Meta:
        model = models.Camper
        fields = ['registration', 'registration__event', 'registration__completed', 'lodging']


class PricingOverrideFilter(django_filters.FilterSet):
    event = event_filter('registration__event')

    class Meta:
        model = models.PricingOverride
        fields = ['registration', 'camper', 'registration__event']


class InvoiceFilter(django_filters.FilterSet):
    event = event_filter('registration__event')

    class Meta:
        model = models.Invoice
        fields = ['registration', 'registration__event', 'registration__completed']


class PaymentFilter(django_filters.FilterSet):
    event = event_filter('registration__event')

    class Meta:
        model = models.Payment
        fields = ['registration', 'registration__event', 'invoice']


class CustomChargeFilter(django_filters.FilterSet):
    event = event_filter('custom_charge_type__event')

    class Meta:
        model = models.CustomCharge
        fields = ['camper', 'custom_charge_type', 'custom_charge_type__event']
