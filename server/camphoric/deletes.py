'''
What deleting something through the admin API does (SPEC §5; §15, DR-54).

A delete is worked out once, as a `Plan`: what would stop it, what goes with
it, and what's left behind but changed. The delete preview shows the plan and
the delete carries it out, so the two can't disagree. Most of a plan comes from
Django's own `Collector` — the same one that performs the delete — asked what
it would do without doing it; a view adds its own rules (a lodging's campers
are unassigned first, an event with registrations can't go) as checks.

Registrations, campers, payments and promo codes are soft-deleted instead
(DR-55, DR-67): their plan lists what goes out of sight with them until they're
restored.
'''

from dataclasses import dataclass, field

from django.db import router, transaction
from django.db.models import ProtectedError, RestrictedError
from django.db.models.deletion import Collector

from camphoric import models

# Deleted by marking them, and restorable (DR-55, DR-67).
SOFT_DELETED = (models.Registration, models.Camper, models.Payment, models.PromoCode)

# Labels shown per kind of thing; `count` always has the full number.
MAX_ITEMS = 20

# Records that are summarized rather than listed: what's left behind for them
# is the same whatever they are.
SUMMARIZED = {'emailmessage', 'emailbatch', 'logentry'}

# Why something can't be deleted, by (referring model, field).
BLOCKED_BECAUSE = {
    ('event', 'organization'): 'It still has events.',
    ('event', 'email_account'): (
        'Events still send with this account. Choose another account for them first.'),
    ('emailmessage', 'account'): 'Email has been sent with this account.',
    ('emailbatch', 'account'): 'Group email has been sent with this account.',
    ('payment', 'invoice'): 'It has payments. Only an invoice with none can be deleted.',
    ('payment', 'refund_of'): 'It has been refunded. Delete its refunds first.',
    ('customcharge', 'custom_charge_type'): 'Campers still have this charge.',
}

# What happens to things left behind, by (model, field) cleared.
LEFT_BEHIND = {
    ('registration', 'registration_type'): 'will have no registration type',
    ('camper', 'lodging'): 'will be unassigned from their lodging',
    ('camper', 'lodging_requested'): 'will no longer show the lodging they asked for',
    ('payment', 'deposit'): 'will no longer be part of a deposit',
    ('invitation', 'registration'): 'will no longer link to a registration',
    ('registration', 'started_with_invitation'): 'will no longer link to the invitation',
    ('logentry', 'actor'): 'stay in the audit log with their email, no longer linked to the user',
    # Many-to-many, by (model, field) of the link.
    ('promocode', 'excluded_registration_types'): 'will no longer exclude it',
}
# The same for soft-deleted ones (a restored one is without the link too).
DELETED_LEFT_BEHIND = {
    ('promocode', 'excluded_registration_types'):
        'are deleted, and won\'t exclude it if restored',
}
EMAIL_LEFT_BEHIND = 'stay in the email history'


def label(instance):
    if isinstance(instance, models.Registration):
        return instance.registrant_email or str(instance)
    return str(instance)


def _kind(model, count):
    meta = model._meta
    return str(meta.verbose_name if count == 1 else meta.verbose_name_plural)


def _entry(model, instances, **extra):
    instances = list(instances)
    listed = [] if model._meta.model_name in SUMMARIZED else instances[:MAX_ITEMS]
    return {
        'type': model._meta.model_name,
        'name': _kind(model, len(instances)),
        'count': len(instances),
        'items': [label(instance) for instance in listed],
        **extra,
    }


@dataclass
class Plan:
    instance: object
    blocked_by: list = field(default_factory=list)
    deletes: list = field(default_factory=list)
    changes: list = field(default_factory=list)
    restorable: bool = False
    # Run, in order and in the delete's transaction, before the delete itself.
    steps: list = field(default_factory=list)
    # (model name, field name) a check has already described; the collector's
    # own clearing of them isn't listed again.
    covered: set = field(default_factory=set)

    @property
    def can_delete(self):
        return not self.blocked_by

    def block(self, detail, instances=()):
        instances = list(instances)
        self.blocked_by.append({
            'detail': detail,
            'count': len(instances),
            'items': [label(instance) for instance in instances[:MAX_ITEMS]],
        })

    def change(self, model, instances, description):
        instances = list(instances)
        if instances:
            self.changes.append(_entry(model, instances, description=description))

    def preview(self):
        return {
            'can_delete': self.can_delete,
            'blocked_by': self.blocked_by,
            'deletes': self.deletes,
            'changes': self.changes,
            'restorable': self.restorable,
        }

    def carry_out(self):
        '''Delete as planned; a 409 if something changed since to stop it.'''
        from camphoric.serializers import Conflict

        if not self.can_delete:
            raise Conflict(' '.join(blocker['detail'] for blocker in self.blocked_by))
        try:
            with transaction.atomic():
                for step in self.steps:
                    step()
                if self.restorable:
                    self.instance.soft_delete()
                else:
                    self.instance.delete()
        except (ProtectedError, RestrictedError):
            raise Conflict(' '.join(
                blocker['detail'] for blocker in plan(self.instance).blocked_by
            ) or 'Something still uses this, so it can\'t be deleted.')


def plan(instance, checks=()):
    '''The plan for deleting `instance`: the collector's, plus each `check(instance, plan)`.'''
    result = Plan(instance)
    for check in checks:
        check(instance, result)
    if isinstance(instance, SOFT_DELETED):
        _hide(instance, result)
    else:
        _collect(instance, result)
    return result


def _hide(instance, result):
    '''A soft delete: what goes out of sight with it, until it's restored.'''
    result.restorable = True
    if isinstance(instance, models.Registration):
        hidden = [
            (models.Camper, instance.campers.all()),
            (models.Invoice, models.Invoice.objects.filter(registration=instance)),
            (models.Payment, models.Payment.objects.filter(registration=instance)),
            (models.CustomCharge,
             models.CustomCharge.objects.filter(camper__registration=instance)),
        ]
    elif isinstance(instance, models.Camper):
        hidden = [(models.CustomCharge, models.CustomCharge.objects.filter(camper=instance))]
    elif isinstance(instance, models.PromoCode):
        # Registrations that have the code keep it, and its discount (DR-67).
        hidden = []
        result.change(
            models.Registration, instance.registrations.order_by('id'),
            'will keep this code and its discount')
    else:
        hidden = []
    for model, queryset in hidden:
        instances = list(queryset.order_by('id'))
        if instances:
            result.deletes.append(_entry(model, instances))


def _collect(instance, result):
    collector = Collector(using=router.db_for_write(type(instance)), origin=instance)
    try:
        collector.collect([instance])
    except ProtectedError as error:
        _blocked(instance, collector, error.protected_objects, result)
        return
    except RestrictedError as error:
        _blocked(instance, collector, error.restricted_objects, result)
        return

    going = {}
    # Edit leases go with what they're on, unremarked: they say only who is
    # editing it now (DR-110).
    collector.data.pop(models.EditLease, None)
    collector.fast_deletes = [qs for qs in collector.fast_deletes
                              if qs.model is not models.EditLease]
    for model, instances in collector.data.items():
        going.setdefault(model, set()).update(i for i in instances if i != instance)
    for queryset in collector.fast_deletes:
        going.setdefault(queryset.model, set()).update(queryset)
    for model, instances in going.items():
        if instances and model._meta.auto_created:
            _unlinked(model, instances, going, result)
        elif instances:
            result.deletes.append(_entry(model, sorted(instances, key=lambda i: i.pk)))

    left = {}
    for (cleared, _value), batches in collector.field_updates.items():
        model = cleared.model
        key = (model._meta.model_name, cleared.name)
        if key in result.covered:
            continue
        instances = {i for batch in batches for i in batch}
        left.setdefault(key, (model, set()))[1].update(instances)
    for (model_name, field_name), (model, instances) in left.items():
        description = EMAIL_LEFT_BEHIND if model_name in ('emailmessage', 'emailbatch') \
            else LEFT_BEHIND.get((model_name, field_name), 'will no longer link to it')
        result.change(model, sorted(instances, key=lambda i: i.pk), description)


def _unlinked(through, links, going, result):
    '''Many-to-many links going with it: what has them stays, without the link.'''
    owner = through._meta.auto_created
    m2m = next(f for f in owner._meta.many_to_many if f.remote_field.through is through)
    owners = {getattr(link, m2m.m2m_field_name()) for link in links}
    owners -= going.get(owner, set()) | {result.instance}
    key = (owner._meta.model_name, m2m.name)
    if key in result.covered:
        return
    description = LEFT_BEHIND.get(key, 'will no longer link to it')
    # Soft-deleted ones (promo codes) are out of sight, so they're listed apart.
    live = sorted((o for o in owners if getattr(o, 'deleted_at', None) is None),
                  key=lambda i: i.pk)
    deleted = sorted((o for o in owners if getattr(o, 'deleted_at', None) is not None),
                     key=lambda i: i.pk)
    result.change(owner, live, description)
    result.change(owner, deleted, DELETED_LEFT_BEHIND.get(key, description))


def _blocked(instance, collector, referrers, result):
    '''Group what refers to what's being deleted by why, for `blocked_by`.'''
    targets = {(type(instance), instance.pk)}
    for model, instances in collector.data.items():
        targets.update((model, i.pk) for i in instances)
    reasons = {}
    for referrer in referrers:
        reasons.setdefault(_why(referrer, targets), []).append(referrer)
    for detail, instances in reasons.items():
        result.block(detail, sorted(instances, key=lambda i: (type(i).__name__, i.pk)))


def _why(referrer, targets):
    model = type(referrer)
    for fk in model._meta.concrete_fields:
        related = getattr(fk, 'related_model', None)
        if related is None or (related, getattr(referrer, fk.attname)) not in targets:
            continue
        reason = BLOCKED_BECAUSE.get((model._meta.model_name, fk.name))
        if reason:
            return reason
    return f'{_kind(model, 2).capitalize()} still use it.'


# Checks: a view's own rules, as `check(instance, plan)` ------------------------

def only_group_templates(template, result):
    if template.purpose != models.EmailTemplatePurpose.GROUP:
        result.block('The confirmation and invitation emails can\'t be deleted; edit them instead.')


def no_registrations(event, result):
    # Deleted ones too: they can still be restored.
    registrations = models.Registration.all_objects.filter(event=event).order_by('id')
    if registrations.exists():
        result.block('People have registered for this event, so it can\'t be deleted.',
                     registrations)


def with_invitation_email(registration_type, result):
    '''A registration type's invitation email goes with it, rather than being left orphaned.'''
    template = registration_type.invitation_template
    if template is None:
        return
    result.deletes.append(_entry(models.EmailTemplate, [template]))
    sent = template.messages.order_by('id')
    result.change(models.EmailMessage, sent, EMAIL_LEFT_BEHIND)
    result.steps.append(template.delete)


def unassign_campers(lodging, result):
    '''
    The campers in a lodging, or in any lodging under it, are unassigned (and
    their stay cleared) one by one, so pricing is recalculated and each is logged.
    '''
    ids, level = [lodging.id], [lodging.id]
    while level:
        children = models.Lodging.objects.filter(parent_id__in=level)
        level = list(children.values_list('id', flat=True))
        ids += level
    # Deleted campers too, so one restored later isn't left with a stay and no lodging.
    campers = list(models.Camper.all_objects.filter(lodging_id__in=ids).order_by('id'))
    result.change(models.Camper, campers, LEFT_BEHIND[('camper', 'lodging')])
    result.covered.add(('camper', 'lodging'))

    def unassign():
        # Their registrations first, as every camper write takes them (DR-109).
        registrations = {camper.registration_id for camper in campers}
        list(models.Registration.all_objects.select_for_update()
             .filter(id__in=registrations).order_by('id'))
        for camper in campers:
            camper.lodging = None
            camper.stay = None
            camper.save()
    result.steps.append(unassign)


def not_yourself(user, instance, result):
    if instance.pk == user.pk:
        result.block('You can\'t delete your own account.')


def payment_has_no_refunds(payment, result):
    '''A payment that has been refunded can't go while its refunds stay (DR-94).'''
    refunds = models.Payment.all_objects.filter(
        refund_of=payment, deleted_at__isnull=True).order_by('id')
    if refunds.exists():
        result.block('It has been refunded. Delete its refunds first.', refunds)


def paypal_refund_stays_refunded(payment, result):
    '''Deleting the record of a PayPal refund doesn't take the money back from the payer.'''
    if payment.amount < 0 and payment.paypal_transaction_id:
        result.change(models.Payment, [payment],
                      'stays refunded in PayPal: deleting this record doesn\'t undo the refund')


def not_a_registration_invoice(invoice, result):
    '''
    The registration's own invoice is cancelled, not deleted: without it, a
    registrant's payment page would make a new one (DR-105).
    '''
    if invoice.origin == models.InvoiceOrigin.REGISTRATION:
        result.block('It\'s the registration\'s own invoice: deleting it would let the '
                     'registrant\'s payment page make a new one. Cancel it instead.')


def invoice_has_no_payments(invoice, result):
    '''Only an invoice nothing was ever paid on can be deleted (deleted payments count).'''
    payments = models.Payment.all_objects.filter(invoice=invoice).order_by('id')
    if payments.exists():
        result.block('It has payments. Only an invoice with none can be deleted; '
                     'cancel it instead.', payments)


def invoice_has_no_paypal_payment_underway(invoice, result):
    '''
    Nor one PayPal may yet record a payment on: one it's processing, or whose
    capture hasn't settled. Gone, the payment would never be recorded (#767).
    Asked again with the invoice held, in the delete itself, for a capture that
    started since.
    '''
    _no_paypal_payment_underway(invoice.registration_id, [invoice.pk], result,
                                'it can\'t be deleted')


def registration_has_no_paypal_payment_underway(registration, result):
    '''
    A registration goes out of sight with its invoices: not while PayPal may
    yet record a payment on one of them (#767).
    '''
    ids = list(models.Invoice.all_objects.filter(registration=registration).values_list(
        'pk', flat=True))
    _no_paypal_payment_underway(registration.pk, ids, result,
                                'its registration can\'t be deleted')


def _no_paypal_payment_underway(registration_id, invoice_ids, result, refused):
    from camphoric import invoices
    from camphoric.serializers import Conflict

    def held(rows):
        return next((row for row in rows if invoices.capture_unsettled(row)), None)

    found = held(models.Invoice.all_objects.filter(pk__in=invoice_ids).order_by('id'))
    if found is not None:
        result.block(invoices.held_message(found, refused))
        return

    def still_none():
        # The registration first, then its invoices, as a capture takes them.
        # The delete views have already locked the record being deleted the
        # same way (views.lock_registration_first, for an invoice too), so no
        # lock is taken here out of that order.
        models.Registration.all_objects.select_for_update().filter(
            pk=registration_id).first()
        found = held(models.Invoice.all_objects.select_for_update().filter(
            pk__in=invoice_ids).order_by('id'))
        if found is not None:
            raise Conflict(invoices.held_message(found, refused))
    result.steps.append(still_none)
