'''
The records admins edit, each named by a slug (its model name: `registration`,
`camper`, `pricingoverride`, …) and tied to the event it belongs to. Edit
leases name records this way (camphoric.leases, SPEC §9.8, DR-110).
'''

from operator import attrgetter

from django.http import Http404

from camphoric import models

# The model, and the path from one of its records to its event's id.
TRACKED = {
    model._meta.model_name: (model, attrgetter(path))
    for model, path in (
        (models.Event, 'id'),
        (models.RegistrationType, 'event_id'),
        (models.PromoCode, 'event_id'),
        (models.Registration, 'event_id'),
        (models.Camper, 'registration.event_id'),
        (models.Lodging, 'event_id'),
        (models.CustomChargeType, 'event_id'),
        (models.CustomCharge, 'camper.registration.event_id'),
        (models.Deposit, 'event_id'),
        (models.Invoice, 'registration.event_id'),
        (models.Payment, 'registration.event_id'),
        (models.PricingOverride, 'registration.event_id'),
        (models.Report, 'event_id'),
        (models.EmailTemplate, 'event_id'),
    )
}


def slug_of(instance):
    return instance._meta.model_name


def event_id_of(instance):
    return TRACKED[slug_of(instance)][1](instance)


def record(slug, object_id):
    '''The record a slug and id name, deleted or not; 404 when there's none.'''
    if slug not in TRACKED:
        raise Http404(f'No such kind of record: {slug}')
    model = TRACKED[slug][0]
    try:
        return model._base_manager.get(pk=object_id)
    except (model.DoesNotExist, ValueError, TypeError):
        raise Http404(f'No such {slug}: {object_id}')
