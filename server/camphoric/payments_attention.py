'''
What an event's money needs doing (SPEC §8.11, §9.7; DR-168): the "needs
attention" list of the Payments area — refunds to give, invoices to make or
send, and PayPal orders to check. It's built from the same ledger the
registration screen shows (`invoices.ledgers`) and the same invoice statuses,
so the two never disagree.

- `refund_due`: the registration's balance is below 0. Listed once, for the
  whole difference, naming the invoice to refund on (an overpaid one first)
  and whether it can go back through PayPal: a PayPal or card payment on that
  invoice with something left to refund, made within PayPal's 180 days.
- `overpaid_invoice`: an invoice's payments are more than it asks, on a
  registration that isn't owed a refund overall (one that is lists only the
  refund, so the same money isn't listed twice).
- `not_invoiced`: money owed that no open invoice asks for yet
  (`uninvoiced_balance`).
- `past_due`: an open invoice with money due whose due date has passed, on a
  registration that still owes.
- `online_unfinished`: a PayPal order made for an invoice that was never
  confirmed (nothing paid on the invoice yet), or a capture PayPal has been
  processing for longer than the worker asks about it.

An invoice PayPal may yet record a payment on (`capture_unsettled`) is left
out of `past_due` and of the unconfirmed orders: its payment is on its way.
'''

from datetime import timedelta

from django.utils import timezone

from camphoric import invoices, models

REFUND_DUE = 'refund_due'
OVERPAID_INVOICE = 'overpaid_invoice'
NOT_INVOICED = 'not_invoiced'
PAST_DUE = 'past_due'
ONLINE_UNFINISHED = 'online_unfinished'
KINDS = (REFUND_DUE, OVERPAID_INVOICE, NOT_INVOICED, PAST_DUE, ONLINE_UNFINISHED)

# PayPal refunds a capture for 180 days after it was made; after that, money
# goes back some other way and the refund is recorded by hand.
PAYPAL_REFUND_WINDOW = timedelta(days=180)


def payments_attention(event, now=None):
    '''The event's "needs attention" items, in `KINDS` order, then by registration.'''
    now = now or timezone.now()
    today = timezone.localdate(now)
    registrations = list(
        models.Registration.objects.filter(event=event).prefetch_related('campers')
        .order_by('id'))
    ledgers = invoices.ledgers(registrations)
    invoices_of = {}
    for invoice in models.Invoice.objects.filter(registration__event=event) \
            .prefetch_related('payments').order_by('created_at', 'id'):
        invoices_of.setdefault(invoice.registration_id, []).append(invoice)

    items = []
    for registration in registrations:
        items += _registration_items(
            registration, ledgers[registration.id], invoices_of.get(registration.id, []),
            now, today)
    items.sort(key=lambda item: KINDS.index(item['kind']))  # stable: by registration within
    return items


def _registration_items(registration, ledger, registration_invoices, now, today):
    def item(kind, amount, invoice=None, **extra):
        return {
            'kind': kind,
            'registration': registration.id,
            'registrant_email': registration.registrant_email,
            'campers': [str(camper) for camper in registration.campers.all()],
            'invoice': invoice.id if invoice is not None else None,
            'amount': f'{invoices.money(amount):.2f}',
            'due_on': None,
            'payment': None,
            'paypal_refund': False,
            'paypal_processing': False,
            **extra,
        }

    live = [invoice for invoice in registration_invoices if invoice.cancelled_at is None]
    overpaid = [invoice for invoice in live if invoice.overpaid > 0]
    items = []

    if ledger.balance < 0:
        invoice, payment = _refund_source(overpaid, registration_invoices, today)
        items.append(item(
            REFUND_DUE, -ledger.balance, invoice,
            payment=payment.id if payment is not None else None,
            paypal_refund=payment is not None))
    else:
        items += [item(OVERPAID_INVOICE, invoice.overpaid, invoice) for invoice in overpaid]

    if ledger.uninvoiced_balance > 0:
        items.append(item(NOT_INVOICED, ledger.uninvoiced_balance))

    for invoice in live:
        held = invoices.capture_unsettled(invoice, now)
        # Only while the registration still owes: an invoice left asking after
        # the price fell, or a refund, isn't money anyone owes.
        if ledger.balance > 0 and invoice.amount_due > 0 and invoice.due_on is not None \
                and invoice.due_on < today and not held:
            items.append(item(PAST_DUE, invoice.amount_due, invoice, due_on=invoice.due_on))
        if invoices.capture_watch_lapsed(invoice, now):
            items.append(item(ONLINE_UNFINISHED, invoice.amount_due, invoice,
                              paypal_processing=True))
        elif invoice.pending_paypal_order_id and invoice.amount_paid <= 0 \
                and invoice.amount_due > 0 and not held:
            items.append(item(ONLINE_UNFINISHED, invoice.amount_due, invoice))
    return items


def _refund_source(overpaid, registration_invoices, today):
    '''
    The invoice a registration's refund goes on, and the PayPal payment on
    that same invoice it can go back from (a refund is recorded on its
    payment's invoice): an overpaid invoice first; else the invoice of the
    payment PayPal can refund the most from; else the one holding the most
    money, refunded by hand.
    '''
    if overpaid:
        return overpaid[0], _paypal_refundable_payment([overpaid[0]], today)
    payment = _paypal_refundable_payment(registration_invoices, today)
    if payment is not None:
        return next(i for i in registration_invoices if i.id == payment.invoice_id), payment
    holding = [invoice for invoice in registration_invoices if invoice.amount_paid > 0]
    return max(holding, key=lambda invoice: invoice.amount_paid, default=None), None


def _paypal_refundable_payment(registration_invoices, today):
    '''
    The payment on these invoices a refund can go back through PayPal from: a
    PayPal or card payment with a capture, something left to refund, and made
    within PayPal's 180 days. The one with the most left (the newest of
    those), or None.
    '''
    payments = [payment for invoice in registration_invoices for payment in invoice.payments.all()]
    refunded = {}
    for payment in payments:
        if payment.refund_of_id is not None:
            refunded[payment.refund_of_id] = \
                refunded.get(payment.refund_of_id, invoices.ZERO) - invoices.money(payment.amount)

    def left(payment):
        return invoices.money(payment.amount) - refunded.get(payment.id, invoices.ZERO)

    candidates = [
        payment for payment in payments
        if payment.amount > 0 and payment.payment_type in invoices.ONLINE_TYPES
        and invoices.capture_id_of(payment)
        and left(payment) > 0
        and today - _paid_on(payment) <= PAYPAL_REFUND_WINDOW
    ]
    return max(candidates, key=lambda payment: (left(payment), _paid_on(payment), payment.id),
               default=None)


def _paid_on(payment):
    return payment.paid_on or timezone.localdate(payment.created_at)
