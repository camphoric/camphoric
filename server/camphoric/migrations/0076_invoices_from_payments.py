'''
Existing payments become invoices, with every balance unchanged (SPEC DR-92).

For each registration:

1. Its first payment, recorded as `initial_payment` (what the registrant chose
   to pay when registering), becomes a `registration` invoice. For a PayPal or
   card payer the handling fee in its price moves onto that invoice; the
   PayPal payment is linked to it (or, when verifying it failed back then, its
   order is left pending for "Check PayPal order"). For a check payer, the
   first live check is linked to it; otherwise it stays open. A registration
   from before `initial_payment` was kept gets its invoice from its first
   payment, or, with none, for its price — so how it chose to pay is kept.
2. Every other payment goes where a payment recorded now would (DR-87): on
   the registration invoice while it still has money due (the rest of a
   deposit, say), else on a `payment_received` invoice of its own — cancelled,
   for a deleted payment. A negative one — a refund recorded by hand — gets a
   "Refund given" invoice that nets to it.
3. A handling fee no invoice took goes on the earliest live online payment's
   invoice, or a `migrated` invoice of its own.
4. The fee leaves the stored price (without repricing: date-based rules would
   drift), with the overrides that kept it (DR-78).
5. PayPal payments get their transaction (capture) id.

Then every completed registration's balance is checked against what it was;
any difference aborts the migration. Incomplete registrations never paid
anything; their fee is only taken out of the price.
'''

from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations

CENT = Decimal('0.01')
ZERO = Decimal('0.00')
HANDLING = 'handling'
HANDLING_LABEL = 'Electronic payment handling'
ONLINE = ('PayPal', 'Card')
HANDLING_FIXED_REASON = 'Kept at the amount when paid online'


def money(value):
    if value is None or value == '':
        return ZERO
    return Decimal(str(value)).quantize(CENT, ROUND_HALF_UP)


def number(amount):
    '''A money amount as pricing results store it: an int when whole, else a float.'''
    return int(amount) if amount == amount.to_integral_value() else float(amount)


def capture_id(response):
    units = (response or {}).get('purchase_units') or [{}]
    captures = ((units[0] or {}).get('payments') or {}).get('captures') or []
    return captures[0].get('id') if captures else None


def convert(apps, schema_editor):
    Registration = apps.get_model('camphoric', 'Registration')
    Payment = apps.get_model('camphoric', 'Payment')
    Invoice = apps.get_model('camphoric', 'Invoice')
    PricingOverride = apps.get_model('camphoric', 'PricingOverride')

    notes = []
    mismatches = []
    used_transaction_ids = set()

    def new_invoice(registration, created_at, **fields):
        invoice = Invoice.objects.create(registration=registration, **fields)
        Invoice.objects.filter(pk=invoice.pk).update(created_at=created_at)
        return invoice

    for reg in Registration.objects.all().order_by('id'):
        results = dict(reg.server_pricing_results or {})
        handling = money(results.get(HANDLING))
        payments = list(Payment.objects.filter(registration=reg)
                        .order_by('paid_on', 'created_at', 'id'))
        live_paid = sum((money(p.amount) for p in payments if p.deleted_at is None), ZERO)
        old_balance = money(results.get('total')) - live_paid
        unlinked = list(payments)
        handling_placed = False
        registration_invoice = None
        registration_paid = ZERO

        initial = reg.initial_payment if isinstance(reg.initial_payment, dict) else None
        initial_total = money(initial.get('total')) if initial else ZERO
        description = str((initial or {}).get('type') or '')[:255]
        online = reg.payment_type in ONLINE
        first = None
        if reg.completed and reg.payment_type and initial is None:
            # Registered before the first payment was kept on the registration
            # (2023): it's their first payment, or else what they owed.
            live = [p for p in unlinked if p.deleted_at is None and money(p.amount) > 0]
            first = next((p for p in live if online and p.paypal_response), None) or \
                next(iter(live), None)
            initial_total = money(first.amount) if first else money(results.get('total'))
            description = 'Initial payment' if first else 'Registration'
            notes.append(f'registration {reg.id}: no initial payment was kept; its registration '
                         f'invoice is its {"first payment" if first else "price"}')
        if reg.completed and initial_total > 0:
            if first is not None:
                linked = first
                fee = min(handling, initial_total) if online else ZERO
            elif online:
                linked = next((p for p in unlinked if p.paypal_response), None)
                fee = min(handling, initial_total)
            else:
                linked = next((p for p in unlinked
                               if p.deleted_at is None and p.payment_type == 'Check'), None)
                fee = ZERO
            amount = initial_total - fee
            invoice = new_invoice(
                reg, reg.created_at, origin='registration',
                description=description, amount=amount, handling=fee,
                payment_type=reg.payment_type)
            handling_placed = fee > 0 and fee == handling
            if fee and fee != handling:
                notes.append(f'registration {reg.id}: part of its handling fee was on its '
                             'first payment; the rest goes on a separate invoice')
                handling -= fee
            registration_invoice = invoice
            if linked is not None:
                Payment.objects.filter(pk=linked.pk).update(invoice=invoice)
                unlinked.remove(linked)
                if linked.deleted_at is None:
                    registration_paid += money(linked.amount)
            elif online and isinstance(reg.paypal_response, dict) and \
                    reg.paypal_response.get('id'):
                Invoice.objects.filter(pk=invoice.pk).update(
                    pending_paypal_order_id=str(reg.paypal_response['id'])[:64])
                notes.append(f'registration {reg.id}: its PayPal order '
                             f'{reg.paypal_response["id"]} was never recorded; it is pending '
                             f'on invoice #{invoice.id} for "Check PayPal order"')

        for payment in unlinked:
            # Like a payment recorded now (DR-87): it goes on the registration
            # invoice while that still has money due — the rest of a deposit,
            # say — and otherwise on an invoice of its own.
            amount = money(payment.amount)
            if registration_invoice is not None and payment.deleted_at is None and amount > 0 \
                    and registration_paid < registration_invoice.amount + \
                    registration_invoice.handling:
                Payment.objects.filter(pk=payment.pk).update(invoice=registration_invoice)
                registration_paid += amount
                continue
            # A negative payment was a refund recorded by hand: its invoice nets
            # to it, so nothing shows as due on it.
            refund = amount < 0
            invoice = new_invoice(
                reg, payment.created_at, origin='payment_received',
                description='Refund given' if refund else 'Payment received',
                amount=money(payment.amount), payment_type=payment.payment_type,
                cancelled_at=payment.deleted_at,
                cancel_reason='Its payment was deleted.' if payment.deleted_at else '')
            Payment.objects.filter(pk=payment.pk).update(invoice=invoice)

        if reg.completed and handling > 0 and not handling_placed:
            target = Invoice.objects.filter(
                registration=reg, cancelled_at__isnull=True,
                payments__deleted_at__isnull=True, payments__payment_type__in=ONLINE,
            ).order_by('payments__paid_on', 'payments__created_at', 'id').first()
            if target is not None:
                Invoice.objects.filter(pk=target.pk).update(handling=target.handling + handling)
            else:
                new_invoice(
                    reg, reg.created_at, origin='migrated', description=HANDLING_LABEL,
                    amount=ZERO, handling=handling, payment_type=reg.payment_type)
            notes.append(f'registration {reg.id}: its handling fee of ${handling} had no '
                         'first payment to go on')

        if HANDLING in results:
            results['total'] = number(money(results.get('total')) - money(results[HANDLING]))
            del results[HANDLING]
            overridden = dict(results.get('overridden') or {})
            overridden.pop(HANDLING, None)
            if overridden:
                results['overridden'] = overridden
            else:
                results.pop('overridden', None)
        PricingOverride.objects.filter(registration=reg, camper=None, var=HANDLING).delete()

        updates = {'server_pricing_results': results}
        if reg.completed:
            updates.update(completed_at=reg.created_at, confirmation_sent_at=reg.created_at)
        Registration.objects.filter(pk=reg.pk).update(**updates)

        for payment in payments:
            transaction_id = capture_id(payment.paypal_response)
            if not transaction_id:
                continue
            if transaction_id in used_transaction_ids:
                notes.append(f'payment {payment.id}: PayPal capture {transaction_id} is also on '
                             'another payment; left without a transaction id')
                continue
            used_transaction_ids.add(transaction_id)
            Payment.objects.filter(pk=payment.pk).update(paypal_transaction_id=transaction_id)

        if reg.completed:
            charges = sum((invoice.handling for invoice in Invoice.objects.filter(
                registration=reg, cancelled_at__isnull=True)), ZERO)
            new_balance = money(results.get('total')) + charges - live_paid
            if new_balance != old_balance:
                mismatches.append(f'registration {reg.id}: {old_balance} → {new_balance}')

    if mismatches:
        raise RuntimeError('Converting payments to invoices would change balances:\n'
                           + '\n'.join(mismatches))

    notes += handling_warnings(apps)
    if notes:
        print('\n  Converting payments to invoices:')
        for note in notes:
            print(f'  - {note}')


def handling_warnings(apps):
    '''Templates and deposit logic that read the handling fee as part of the price.'''
    warnings = []
    Event = apps.get_model('camphoric', 'Event')
    EmailTemplate = apps.get_model('camphoric', 'EmailTemplate')
    Report = apps.get_model('camphoric', 'Report')
    for event in Event.objects.all():
        for field in ('confirmation_page_template', 'pre_submit_template'):
            if 'handling' in (getattr(event, field) or ''):
                warnings.append(f'event {event.id} {field} mentions "handling"; the fee is on '
                                'invoices now (invoice.handling)')
        if 'handling' in str(event.registration_deposit_schema or ''):
            warnings.append(f'event {event.id} deposit options mention "handling"; it is no '
                            'longer in the pricing results')
    for template in EmailTemplate.objects.all():
        if 'handling' in f'{template.subject} {template.body}':
            warnings.append(f'email template {template.id} ({template.name}) mentions '
                            '"handling"')
    for report in Report.objects.all():
        if 'pricing.handling' in (report.template or ''):
            warnings.append(f'report {report.id} ({report.title}) reads pricing.handling')
    return warnings


def restore(apps, schema_editor):
    '''The old shape back: the fee in the price, the first payment on the registration.'''
    Registration = apps.get_model('camphoric', 'Registration')
    Payment = apps.get_model('camphoric', 'Payment')
    Invoice = apps.get_model('camphoric', 'Invoice')
    PricingOverride = apps.get_model('camphoric', 'PricingOverride')

    for reg in Registration.objects.all().order_by('id'):
        invoices = list(Invoice.objects.filter(registration=reg).order_by('created_at', 'id'))
        handling = sum((i.handling for i in invoices if i.cancelled_at is None), ZERO)
        results = dict(reg.server_pricing_results or {})
        if handling > 0:
            results['total'] = number(money(results.get('total')) + handling)
            results[HANDLING] = number(handling)

        first = next((i for i in invoices if i.origin == 'registration'), None)
        updates = {'server_pricing_results': results}
        if first is not None:
            first_total = first.amount + first.handling
            online_payment = Payment.objects.filter(
                invoice=first, payment_type__in=ONLINE, amount__gt=0).order_by('id').first()
            updates.update(
                payment_type=first.payment_type,
                initial_payment={
                    'type': first.description,
                    'total': number(first_total),
                    'balance': number(money(results.get('total')) - first_total),
                },
                paypal_response=online_payment.paypal_response if online_payment else None,
            )
        elif reg.completed:
            updates.update(payment_type='Check', initial_payment={
                'type': 'none', 'total': 0, 'balance': number(money(results.get('total')))})
        if handling > 0 and updates.get('payment_type') in ONLINE:
            PricingOverride.objects.update_or_create(
                registration=reg, camper=None, var=HANDLING,
                defaults={'amount': handling, 'reason': HANDLING_FIXED_REASON})
        Registration.objects.filter(pk=reg.pk).update(**updates)

    Payment.objects.update(invoice=None, paypal_transaction_id=None)
    Invoice.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0075_invoices'),
    ]

    operations = [
        migrations.RunPython(convert, restore),
    ]
