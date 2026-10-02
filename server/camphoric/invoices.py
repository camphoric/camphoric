'''
Invoices, payments and the balance (SPEC §9.7; DR-87 to DR-90, DR-94).

- The ledger: what a registration owes is its price plus the handling fees on
  its invoices; what it has paid is the net of its live payments (refunds are
  negative payments); the balance is the difference.
- Where a payment goes: every payment belongs to an invoice. A payment
  recorded without one goes on the oldest invoice with money due, or on a new
  `payment_received` invoice that stands for a bill never sent.
- Payment options: the registration form's deposit choices, worked out here
  rather than in the browser (#675).
- PayPal: the server creates each order for an invoice, checks it and captures
  it, so no money moves until the server says so (DR-90); it also refunds
  captures. When PayPal's answer is lost, the event is emailed the details.
'''

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import json
import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from json_logic import jsonLogic

from camphoric import models, pricing
from camphoric.confirmations import queue_report
from camphoric.paypal import PayPalClient, PayPalError
from camphoric.templating.urls import admin_registration_url

logger = logging.getLogger(__name__)

ZERO = Decimal('0.00')
CENT = Decimal('0.01')
HANDLING_LABEL = 'Electronic payment handling'
ONLINE_TYPES = (models.PaymentType.PAYPAL, models.PaymentType.CARD)
FULL_PAYMENT = 'Full payment'
PAYMENT_RECEIVED_DESCRIPTION = 'Payment received'
# PayPal's limit on an item's name and an order's description.
PAYPAL_TEXT_LIMIT = 127


def money(value):
    '''An amount as a two-place Decimal (None and blanks are zero).'''
    if value is None or value == '':
        return ZERO
    return Decimal(str(value)).quantize(CENT, ROUND_HALF_UP)


def today():
    return timezone.localdate()


# The ledger ---------------------------------------------------------------------

@dataclass(frozen=True)
class Ledger:
    price: Decimal              # the registration's priced total
    handling_charges: Decimal   # handling on its invoices that aren't cancelled
    total_owed: Decimal         # price + handling charges
    total_paid: Decimal         # net of live payments
    balance: Decimal            # owed − paid; negative: a refund is due
    uninvoiced_balance: Decimal  # balance no open invoice asks for yet (never below 0)

    def as_dict(self):
        return {name: float(value) for name, value in self.__dict__.items()}


def ledgers(registrations):
    '''{registration id: Ledger} for many registrations, in two queries.'''
    registrations = list(registrations)
    ids = [r.id for r in registrations]
    invoices = list(models.Invoice.all_objects.filter(
        registration_id__in=ids, deleted_at__isnull=True,
    ).values('id', 'registration_id', 'amount', 'handling', 'cancelled_at'))
    paid_by_invoice = dict(
        models.Payment.all_objects.filter(
            invoice__registration_id__in=ids, deleted_at__isnull=True)
        .values('invoice_id').annotate(paid=Sum('amount')).values_list('invoice_id', 'paid'))

    by_registration = {}
    for invoice in invoices:
        by_registration.setdefault(invoice['registration_id'], []).append(invoice)

    result = {}
    for registration in registrations:
        price = money((registration.server_pricing_results or {}).get('total'))
        handling = paid = due = ZERO
        for invoice in by_registration.get(registration.id, []):
            invoice_paid = money(paid_by_invoice.get(invoice['id']))
            paid += invoice_paid
            if invoice['cancelled_at'] is None:
                handling += invoice['handling']
                due += max(ZERO, invoice['amount'] + invoice['handling'] - invoice_paid)
        owed = price + handling
        balance = owed - paid
        result[registration.id] = Ledger(
            price=price, handling_charges=handling, total_owed=owed, total_paid=paid,
            balance=balance, uninvoiced_balance=max(ZERO, balance - due))
    return result


def ledger(registration):
    return ledgers([registration])[registration.id]


# Where a payment goes -------------------------------------------------------------

def open_invoices(registration):
    '''The registration's invoices with money due, oldest first.'''
    invoices = models.Invoice.objects.filter(
        registration=registration, cancelled_at__isnull=True,
    ).prefetch_related('payments').order_by('created_at', 'id')
    return [invoice for invoice in invoices if invoice.amount_due > 0]


def invoice_for_payment(registration, amount, payment_type, *, new_invoice=False, user=None):
    '''
    The invoice a payment recorded without one goes on (DR-87): the oldest
    with money due, else a new `payment_received` invoice for exactly it.
    '''
    if not new_invoice:
        invoices = open_invoices(registration)
        if invoices:
            return invoices[0]
    return models.Invoice.objects.create(
        registration=registration,
        origin=models.InvoiceOrigin.PAYMENT_RECEIVED,
        description=PAYMENT_RECEIVED_DESCRIPTION,
        amount=max(ZERO, money(amount)),
        payment_type=payment_type,
        created_by=user if user is not None and user.is_authenticated else None,
    )


def match_received_invoice(invoice):
    '''
    A `payment_received` invoice always asks for exactly what its live payments
    net to, so it never shows money owed — even one holding only a refund,
    which nets below zero; with none left it's cancelled, and a restored
    payment reopens it.
    '''
    if invoice is None or invoice.origin != models.InvoiceOrigin.PAYMENT_RECEIVED:
        return
    invoice = models.Invoice.all_objects.get(pk=invoice.pk)
    payments = list(models.Payment.all_objects.filter(invoice=invoice, deleted_at__isnull=True))
    changed = []
    if not payments:
        if invoice.cancelled_at is None:
            invoice.cancelled_at = timezone.now()
            invoice.cancel_reason = 'Its payment was deleted.'
            changed += ['cancelled_at', 'cancel_reason']
    else:
        net = sum((money(p.amount) for p in payments), ZERO)
        if invoice.cancelled_at is not None:
            invoice.cancelled_at = None
            invoice.cancel_reason = ''
            changed += ['cancelled_at', 'cancel_reason']
        if money(invoice.amount) != net:
            invoice.amount = net
            changed.append('amount')
    if changed:
        invoice.save(update_fields=changed + ['updated_at'])


def refundable(payment):
    '''How much of a payment hasn't been refunded yet.'''
    refunded = models.Payment.all_objects.filter(
        refund_of=payment, deleted_at__isnull=True).aggregate(total=Sum('amount'))['total']
    return max(ZERO, money(payment.amount) + money(refunded))


# Payment options (#675) -------------------------------------------------------------

@dataclass(frozen=True)
class PaymentOption:
    name: str
    title: str
    amount: Decimal
    handling: Decimal  # the fee if it's paid online

    def as_dict(self):
        return {'name': self.name, 'title': self.title,
                'amount': float(self.amount), 'handling': float(self.handling)}


def _parse_option(value):
    '''A deposit choice: the JSON of `{name, logic}`.'''
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        return None
    if not isinstance(parsed, dict) or not isinstance(parsed.get('name'), str):
        return None
    return parsed


def _schema_choices(schema):
    '''
    The deposit schema's choices as `(value, title)`: `oneOf` entries (`const`,
    `title`), or an `enum` with `enumNames`.
    '''
    choices = [(entry.get('const'), entry.get('title'))
               for entry in schema.get('oneOf') or [] if isinstance(entry, dict)]
    if not choices:
        titles = schema.get('enumNames') or []
        choices = [(value, titles[index] if index < len(titles) else None)
                   for index, value in enumerate(schema.get('enum') or [])]
    return choices


def _evaluate(logic, pricing_results, total):
    '''An option's amount: its logic on the pricing results, within [0, total].'''
    try:
        value = jsonLogic(logic, pricing_results)
    except Exception:
        value = None
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        value = total
    return min(max(ZERO, money(value)), total)


def online_fee(event, amount):
    '''The handling fee on paying `amount` online (DR-88); 0 without PayPal or a percent.'''
    if not event.paypal_enabled or not event.epayment_handling or amount <= 0:
        return ZERO
    return pricing.handling_fee(amount, event.epayment_handling)


def payment_options(event, pricing_results):
    '''
    The registrant's payment options (the event's deposit choices), worked out
    on the server: `({title, description, default}, [PaymentOption])`. Without
    a deposit schema there's one option, the full payment.
    '''
    pricing_results = pricing_results or {}
    total = max(ZERO, money(pricing_results.get('total')))
    schema = event.registration_deposit_schema or {}
    options = []
    default = None
    for value, title in _schema_choices(schema):
        parsed = _parse_option(value)
        if parsed is None:
            continue
        amount = _evaluate(parsed.get('logic'), pricing_results, total)
        options.append(PaymentOption(
            name=parsed['name'], title=title or parsed['name'], amount=amount,
            handling=online_fee(event, amount)))
        if value == schema.get('default'):
            default = parsed['name']
    if not options:
        options = [PaymentOption(name=FULL_PAYMENT, title=FULL_PAYMENT, amount=total,
                                 handling=online_fee(event, total))]
        schema = {}
    meta = {
        'title': schema.get('title') or '',
        'description': schema.get('description') or '',
        'default': default or options[0].name,
    }
    return meta, options


def find_option(event, pricing_results, name):
    '''The option called `name`; the default one when `name` is empty.'''
    meta, options = payment_options(event, pricing_results)
    if not name:
        name = meta['default']
    for option in options:
        if option.name == name:
            return option
    return None


# The registration's invoice -----------------------------------------------------------

def registration_invoice(registration):
    '''The invoice the registration's payment step made, if any.'''
    return models.Invoice.objects.filter(
        registration=registration, origin=models.InvoiceOrigin.REGISTRATION,
    ).order_by('created_at', 'id').first()


def prepare_registration_invoice(registration, option, payment_type):
    '''
    The registration invoice for the chosen option, made or rewritten in place
    while nothing has been paid on it (the registrant may change their mind
    after a cancelled PayPal attempt). None when the option asks for nothing.
    '''
    invoice = registration_invoice(registration)
    if invoice is None:
        if option.amount <= 0:
            return None
        invoice = models.Invoice(
            registration=registration, origin=models.InvoiceOrigin.REGISTRATION)
    wanted = {'description': option.title, 'amount': option.amount, 'handling': ZERO,
              'payment_type': payment_type, 'pending_paypal_order_id': None,
              'cancelled_at': None}
    if invoice.pk is not None and all(
            getattr(invoice, name) == value for name, value in wanted.items()):
        return invoice  # a repeat: nothing to change, nothing to log
    for name, value in wanted.items():
        setattr(invoice, name, value)
    invoice.save()
    return invoice


def has_payments(invoice):
    return invoice is not None and models.Payment.all_objects.filter(invoice=invoice).exists()


# PayPal ---------------------------------------------------------------------------

class PaymentProblem(Exception):
    '''
    A payment that didn't go through. `code` says why, for the client:
    `amount_changed`, `declined` and `not_payable` took no money; `unknown`
    may have (PayPal's answer was lost; the event has been emailed).
    '''
    status = {'amount_changed': 409, 'declined': 402, 'not_payable': 409,
              'not_approved': 409, 'mismatch': 400, 'unknown': 502, 'refused': 409,
              'not_configured': 409}

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message

    @property
    def http_status(self):
        return self.status.get(self.code, 400)


def paypal_client(event):
    return PayPalClient(
        settings.PAYPAL_BASE_URL,
        event.paypal_client_id,
        # One secret per server for now; events can't have their own PayPal accounts yet.
        settings.PAYPAL_SECRET,
    )


def item_text(invoice):
    '''The PayPal order's one item: "Total for Invoice #12 for Lark Camp 2027".'''
    prefix = f'Total for Invoice #{invoice.id} for '
    return prefix + invoice.registration.event.name[:PAYPAL_TEXT_LIMIT - len(prefix)]


def _money_value(amount):
    return {'currency_code': 'USD', 'value': f'{money(amount):.2f}'}


def _first_unit(order):
    units = (order or {}).get('purchase_units') or [{}]
    return units[0] or {}


def _capture_of(order):
    '''The capture in a PayPal order (or None before it's captured).'''
    captures = (_first_unit(order).get('payments') or {}).get('captures') or []
    return captures[0] if captures else None


def capture_id_of(payment):
    '''The PayPal capture a payment came from, for refunding it.'''
    if payment.paypal_transaction_id:
        return payment.paypal_transaction_id
    capture = _capture_of(payment.paypal_response)
    return capture.get('id') if capture else None


def _order_payment_type(order, fallback):
    source = (order or {}).get('payment_source') or {}
    if 'card' in source:
        return models.PaymentType.CARD
    if 'paypal' in source:
        return models.PaymentType.PAYPAL
    return fallback or models.PaymentType.PAYPAL


def _check_belongs(invoice, order):
    '''The order must be for this invoice's registration (and this invoice), in USD.'''
    unit = _first_unit(order)
    if unit.get('reference_id') != str(invoice.registration.uuid):
        raise PaymentProblem('mismatch', 'That PayPal order is for another registration.')
    custom_id = unit.get('custom_id')
    if custom_id and custom_id != f'invoice:{invoice.id}':
        raise PaymentProblem('mismatch', 'That PayPal order is for another invoice.')
    currency = (unit.get('amount') or {}).get('currency_code')
    if currency and currency != 'USD':
        raise PaymentProblem('mismatch', f'Unexpected currency {currency}.')


def create_paypal_order(invoice, payment_type):
    '''
    Create the PayPal order for what the invoice still asks, plus the handling
    fee if it has none yet; returns the order id. The fee isn't added to the
    invoice until the order is captured, so an abandoned order adds nothing.
    '''
    event = invoice.registration.event
    if not event.paypal_enabled or not event.paypal_client_id:
        raise PaymentProblem('not_configured', 'This event doesn\'t take payments online.')
    if invoice.cancelled_at is not None:
        raise PaymentProblem('not_payable', 'This invoice has been cancelled.')
    due = invoice.amount_due
    if due <= 0:
        raise PaymentProblem('not_payable', 'Nothing is due on this invoice.')
    fee = online_fee(event, due) if money(invoice.handling) == 0 else ZERO
    value = due + fee
    text = item_text(invoice)
    body = {
        'intent': 'CAPTURE',
        'purchase_units': [{
            'reference_id': str(invoice.registration.uuid),
            'custom_id': f'invoice:{invoice.id}',
            'description': text,
            'amount': {**_money_value(value), 'breakdown': {'item_total': _money_value(value)}},
            'items': [{'name': text, 'quantity': '1', 'unit_amount': _money_value(value)}],
        }],
        'application_context': {'shipping_preference': 'NO_SHIPPING'},
    }
    try:
        order = paypal_client(event).create_order(body, request_id=uuid.uuid4().hex)
    except PayPalError as e:
        logger.error(f'PayPal order for invoice {invoice.id} failed: {e}')
        raise PaymentProblem('declined', 'PayPal couldn\'t start this payment. Please try again.')
    invoice.pending_paypal_order_id = order['id']
    invoice.payment_type = payment_type
    invoice.save(update_fields=['pending_paypal_order_id', 'payment_type', 'updated_at'])
    return order['id']


def record_capture(invoice, order, payment_type=None, notes=''):
    '''
    Record a captured PayPal order as a payment on the invoice, once: a capture
    already recorded (by its capture id) is returned as it is. The handling fee
    goes on the invoice now, as what was captured beyond what was due.
    '''
    capture = _capture_of(order)
    if capture is None or not capture.get('id'):
        raise PaymentProblem('unknown', 'PayPal\'s reply has no capture.')
    existing = models.Payment.all_objects.filter(paypal_transaction_id=capture['id']).first()
    if existing is not None:
        return existing

    event = invoice.registration.event
    amount = money((capture.get('amount') or {}).get('value'))
    due = invoice.amount_due
    if money(invoice.handling) == 0:
        fee = min(max(ZERO, amount - due), online_fee(event, due))
        invoice.handling = fee
    payment_type = _order_payment_type(order, payment_type or invoice.payment_type)
    invoice.payment_type = payment_type
    invoice.pending_paypal_order_id = None
    invoice.save(update_fields=['handling', 'payment_type', 'pending_paypal_order_id',
                                'updated_at'])
    status = capture.get('status')
    note = notes
    if status and status != 'COMPLETED':
        note = f'{note} (PayPal status: {status})'.strip()
    return models.Payment.objects.create(
        registration=invoice.registration,
        invoice=invoice,
        payment_type=payment_type,
        paid_on=today(),
        amount=amount,
        paypal_response=order,
        paypal_transaction_id=capture['id'],
        notes=note,
    )


def _order_amount(order):
    return money((_first_unit(order).get('amount') or {}).get('value'))


def capture_paypal_order(invoice, order_id, payment_type, notes='', request=None):
    '''
    Check the PayPal order the payer approved and capture it (DR-90): the
    money moves only here, and only for what the invoice asks now. An order
    already captured is recorded (or returned) instead of captured again.
    Raises PaymentProblem when it doesn't go through; when PayPal's answer is
    lost the order stays pending and the event is emailed the details.
    '''
    try:
        # A savepoint: a problem undoes anything half done here, but not the
        # caller's work (the registration it completed).
        with transaction.atomic():
            locked = models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)
            return _capture(locked, order_id, payment_type, notes)
    except PaymentProblem as problem:
        if problem.code == 'unknown':
            send_paypal_problem_report(
                invoice, what='capture', error=problem.message, order_id=order_id,
                payment_type=payment_type, request=request)
        raise


def _capture(invoice, order_id, payment_type, notes):
    client = paypal_client(invoice.registration.event)
    try:
        order = client.fetch_order_details(order_id)
    except PayPalError as e:
        if e.unknown:
            raise PaymentProblem('unknown', str(e))
        raise PaymentProblem('mismatch', 'PayPal doesn\'t know that order.')
    _check_belongs(invoice, order)
    status = order.get('status')
    if status == 'COMPLETED':
        return record_capture(invoice, order, payment_type, notes)
    if status != 'APPROVED':
        raise PaymentProblem('not_approved', 'PayPal hasn\'t approved this payment.')
    if order_id != invoice.pending_paypal_order_id or invoice.cancelled_at is not None:
        raise PaymentProblem('not_payable', 'This invoice isn\'t waiting for that payment.')
    due = invoice.amount_due
    fee = online_fee(invoice.registration.event, due) if money(invoice.handling) == 0 else ZERO
    if due <= 0:
        raise PaymentProblem('not_payable', 'Nothing is due on this invoice.')
    if _order_amount(order) != due + fee:
        raise PaymentProblem(
            'amount_changed', 'The amount due has changed. Please try again.')
    try:
        captured = client.capture_order(order_id, request_id=f'capture-{order_id}')
    except PayPalError as e:
        if e.unknown:
            raise PaymentProblem('unknown', str(e))
        if e.issue == 'ORDER_ALREADY_CAPTURED':
            return record_capture(invoice, client.fetch_order_details(order_id), payment_type,
                                  notes)
        raise PaymentProblem('declined', 'PayPal declined this payment. '
                             'Please try another way to pay.')
    capture = _capture_of(captured)
    if capture is None or capture.get('status') not in ('COMPLETED', 'PENDING'):
        raise PaymentProblem('declined', 'PayPal declined this payment. '
                             'Please try another way to pay.')
    return record_capture(invoice, captured, payment_type, notes)


def check_paypal_order(invoice):
    '''
    A registrar's "Check PayPal order": ask PayPal about the invoice's pending
    order; record it if it was captured, else clear it (no money was taken).
    Returns `(result, payment)`.
    '''
    order_id = invoice.pending_paypal_order_id
    if not order_id:
        raise PaymentProblem('not_payable', 'No PayPal order is waiting on this invoice.')
    with transaction.atomic():
        invoice = models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)
        try:
            order = paypal_client(invoice.registration.event).fetch_order_details(order_id)
        except PayPalError as e:
            raise PaymentProblem('unknown' if e.unknown else 'mismatch', str(e))
        _check_belongs(invoice, order)
        if order.get('status') == 'COMPLETED':
            return 'recorded', record_capture(invoice, order, invoice.payment_type,
                                              'Recorded by checking PayPal')
        invoice.pending_paypal_order_id = None
        invoice.save(update_fields=['pending_paypal_order_id', 'updated_at'])
        return 'not_captured', None


def refund_paypal_payment(payment, amount, reason, request_id, request=None):
    '''
    Refund some or all of a PayPal or card payment through PayPal (DR-94), and
    record the refund as a negative payment on the same invoice. A retry with
    the same `request_id` gets PayPal's first refund back, recorded once.
    '''
    amount = money(amount)
    try:
        with transaction.atomic():
            locked = models.Payment.all_objects.select_for_update().get(pk=payment.pk)
            return _refund(locked, amount, reason, request_id)
    except PaymentProblem as problem:
        if problem.code == 'unknown':
            send_paypal_problem_report(
                payment.invoice, what='refund', error=problem.message,
                capture_id=capture_id_of(payment), request_id=request_id, amount=amount,
                payment_type=payment.payment_type, refund_of=payment, request=request)
        raise


def _refund(payment, amount, reason, request_id):
    if payment.deleted_at is not None or money(payment.amount) <= 0:
        raise PaymentProblem('refused', 'Only a payment can be refunded.')
    if payment.payment_type not in ONLINE_TYPES:
        raise PaymentProblem('refused', 'Only PayPal and card payments refund through PayPal.')
    capture_id = capture_id_of(payment)
    if not capture_id:
        raise PaymentProblem(
            'refused', 'This payment has no PayPal capture to refund. Refund it in PayPal, '
            'then record the refund here.')
    if amount <= 0 or amount > refundable(payment):
        raise PaymentProblem(
            'refused', f'You can refund up to ${refundable(payment):.2f} of this payment.')
    try:
        reply = paypal_client(payment.registration.event).refund_capture(
            capture_id, f'{amount:.2f}', reason, request_id=f'refund-{request_id}')
    except PayPalError as e:
        if e.unknown:
            raise PaymentProblem('unknown', str(e))
        raise PaymentProblem('refused', f'PayPal refused the refund: {e}')
    refund_id = (reply or {}).get('id')
    if not refund_id:
        raise PaymentProblem('unknown', 'PayPal\'s reply has no refund id.')
    existing = models.Payment.all_objects.filter(paypal_transaction_id=refund_id).first()
    if existing is not None:
        return existing
    status = reply.get('status')
    notes = reason or 'Refunded through PayPal'
    if status and status != 'COMPLETED':
        notes = f'{notes} (PayPal status: {status})'
    return models.Payment.objects.create(
        registration=payment.registration,
        invoice=payment.invoice,
        payment_type=payment.payment_type,
        paid_on=today(),
        amount=-amount,
        refund_of=payment,
        paypal_response=reply,
        paypal_transaction_id=refund_id,
        notes=notes,
    )


# Telling the organizer ------------------------------------------------------------

def paypal_problem_report(invoice, *, what, error, order_id=None, capture_id=None,
                          request_id=None, amount=None, payment_type=None, refund_of=None,
                          request=None):
    '''The subject and plain-text body of a PayPal problem email (SPEC §9.7).'''
    registration = invoice.registration
    event = registration.event
    campers = ', '.join(
        ' '.join(filter(None, [(c.attributes or {}).get('first_name'),
                               (c.attributes or {}).get('last_name')])) or f'Camper #{c.id}'
        for c in registration.campers.all())
    noun = 'refund' if what == 'refund' else 'payment'
    subject = (f'PayPal {noun} needs checking — Registration #{registration.id}, '
               f'Invoice #{invoice.id}')
    if what == 'refund':
        happened = ('We asked PayPal to refund this payment but got no clear answer. '
                    'The money may have been returned to the payer.')
    else:
        happened = ('We asked PayPal to capture this payment but got no clear answer. '
                    'The payer may have been charged.')
    lines = [
        f'Event: {event.name}',
        '',
        'What happened',
        happened,
        f'Error: {error}',
        f'Time: {timezone.localtime():%Y-%m-%d %H:%M %Z}',
        '',
        'Who',
        f'Registration #{registration.id}, {registration.registrant_email}',
    ]
    if campers:
        lines.append(f'Campers: {campers}')
    link = admin_registration_url(registration, request)
    if link:
        lines.append(f'In the admin: {link}')
    lines += ['', 'What for',
              f'Invoice #{invoice.id}' + (f': {invoice.description}' if invoice.description
                                          else '')]
    if what == 'refund':
        lines.append(f'Refund requested: ${money(amount):.2f}')
        if refund_of is not None:
            lines.append(f'Of payment #{refund_of.id}: ${money(refund_of.amount):.2f}')
    else:
        due = invoice.amount_due
        fee = online_fee(event, due) if money(invoice.handling) == 0 else ZERO
        lines.append(f'Expected: ${due + fee:.2f} (handling ${fee:.2f})')
    if payment_type:
        lines.append(f'Paid by: {payment_type}')
    lines += ['', 'PayPal references']
    if order_id:
        lines.append(f'Order id: {order_id}')
    if capture_id:
        lines.append(f'Capture id: {capture_id}')
    if request_id:
        lines.append(f'Request id: {request_id}')
    lines.append('')
    if what == 'refund':
        lines += [
            'What to do',
            '1. Look up the capture in your PayPal dashboard.',
            '2. If PayPal made the refund, record it on the invoice by hand. If it didn\'t, '
            'try the refund again.',
        ]
    else:
        lines += [
            'What the registrant was told',
            'We couldn\'t confirm your payment with PayPal. Please don\'t pay again; '
            'we\'ll check and let you know.',
            '',
            'What to do',
            '1. Find the order id in your PayPal dashboard.',
            '2. Open the registration\'s invoice and press "Check PayPal order". It records '
            'the payment if it went through, or clears the pending order if it didn\'t.',
        ]
    return subject, '\n'.join(lines) + '\n'


def send_paypal_problem_report(invoice, **details):
    '''
    Email the event the details of a PayPal capture or refund whose outcome is
    unknown, once per order (or refund request); always logged as an error.
    '''
    subject, body = paypal_problem_report(invoice, **details)
    logger.error(f'{subject}\n{body}')
    key = details.get('order_id') or details.get('request_id') or str(invoice.id)
    queued = queue_report(
        invoice.registration, models.EmailMessageKind.PAYMENT_REPORT, subject, body,
        dedupe_key=f'paypal-problem:{key}')
    if not queued:
        logger.error(f'No PayPal problem email sent for invoice {invoice.id}: '
                     'the event has no confirmation_email_from address.')
    return queued
