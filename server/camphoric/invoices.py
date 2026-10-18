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
  captures. When PayPal's answer is lost, or recording what it did fails, the
  event is emailed the details; a capture that never got recorded is found by
  the worker (#804). A capture PayPal hasn't completed (PENDING) isn't a
  payment yet: the worker asks until PayPal completes it, then records it (#767).
'''

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import json
import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from json_logic import jsonLogic

from camphoric import models, pricing
from camphoric.confirmations import queue_report
from camphoric.paypal import PayPalClient, PayPalError
from camphoric.worker import still_working
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
# A capture still pending this long after it started may have taken the money
# unrecorded (the process died); the worker then asks PayPal (#804).
UNRECORDED_CAPTURE_AFTER = timedelta(minutes=15)
UNRECORDED_CAPTURE_RETRIES_FOR = timedelta(days=1)
UNRECORDED_CAPTURES_PER_RUN = 5
CAPTURE_UNSETTLED = ('A PayPal payment on this invoice is still being confirmed. Please don\'t '
                     'pay again; check back in a few minutes.')
# A capture PayPal says is PENDING is asked about again this often, for this
# long: well past the few business days an eCheck takes to clear (#767). The
# invoice stays held after that, until "Check PayPal order" settles it.
PENDING_CAPTURE_ASK_EVERY = timedelta(minutes=30)
PENDING_CAPTURE_WATCHED_FOR = timedelta(days=30)
CAPTURE_PENDING = ('PayPal is still processing a payment on this invoice. Please don\'t pay '
                   'again: it\'s recorded here once PayPal completes it.')
# Capture statuses whose money reached the event (it may have been refunded since).
CAPTURED = ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED')
DECLINED = 'PayPal declined this payment. Please try another way to pay.'


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
    with money due, else a new `payment_received` invoice for exactly it. Not
    one held for a PayPal payment that may yet be recorded on it (#767).
    '''
    if not new_invoice:
        invoices = [invoice for invoice in open_invoices(registration)
                    if not capture_unsettled(invoice)]
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


def refunded(payment):
    '''How much of a payment its live refunds have given back (a positive amount).'''
    total = models.Payment.all_objects.filter(
        refund_of=payment, deleted_at__isnull=True).aggregate(total=Sum('amount'))['total']
    return -money(total)


def refundable(payment):
    '''How much of a payment hasn't been refunded yet.'''
    return max(ZERO, money(payment.amount) - refunded(payment))


def lock_payment(payment):
    '''
    The payment as committed, its row held until the transaction ends. A
    refund through PayPal holds it while it asks PayPal and records the
    answer, so whatever checks what's left of a payment before changing its
    refunds holds it too, and waits its turn (#767). A refund's own row, when
    it's the one changing, is taken before its payment's.
    '''
    return models.Payment.all_objects.select_for_update().get(pk=payment.pk)


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


# The registration's invoice -----------------------------------------------------------

def registration_invoice(registration):
    '''The invoice the registration's payment step made, if any.'''
    return models.Invoice.objects.filter(
        registration=registration, origin=models.InvoiceOrigin.REGISTRATION,
    ).order_by('created_at', 'id').first()


# What the payment step writes for the chosen option; an organizer changing
# any of them (or cancelling or reopening the invoice) stops it (DR-105).
PAYMENT_STEP_FIELDS = ('description', 'amount', 'handling')


INVOICE_CHANGED = ('The organizers changed what\'s due on your registration. '
                   'Please check the amount and choose again.')
INVOICE_CANCELLED = 'The organizers cancelled this invoice. Please contact them.'


def cancelled_registration_invoice(registration):
    '''Whether the organizers cancelled the registration's invoice: nothing to pay (DR-105).'''
    invoice = registration_invoice(registration)
    return invoice is not None and invoice.cancelled_at is not None


def organizer_set(invoice):
    '''The registration invoice is the organizers' to set: one changed it, and it's open.'''
    return (invoice is not None and invoice.organizer_changed_at is not None
            and invoice.cancelled_at is None)


def invoice_option(invoice):
    '''The registration invoice as a payment option: what it asks now, and the fee online.'''
    due, fee = order_amounts(invoice)
    return PaymentOption(name=f'invoice:{invoice.id}',
                         title=invoice.description or f'Invoice #{invoice.id}',
                         amount=due, handling=fee)


def registration_payment_options(registration):
    '''
    The payment options for this registration, as `payment_options`: the
    event's, or — once an organizer has set its invoice — that invoice alone,
    for what it asks now (DR-105).
    '''
    invoice = registration_invoice(registration)
    if organizer_set(invoice):
        option = invoice_option(invoice)
        return {'title': '', 'description': '', 'default': option.name}, [option]
    return payment_options(registration.event, registration.server_pricing_results)


def prepare_registration_invoice(registration, option, payment_type):
    '''
    The registration invoice for the chosen option, made or rewritten in place
    while nothing has been paid on it (the registrant may change their mind
    after a cancelled PayPal attempt). None when the option asks for nothing.
    Once an organizer has changed it, only how they chose to pay is recorded:
    it asks what the organizer set. A cancelled one is refused (DR-105).
    '''
    invoice = registration_invoice(registration)
    if invoice is not None:
        # Locked, so an organizer's change can't land between reading and saving.
        invoice = models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)
    if invoice is not None and invoice.cancelled_at is not None:
        raise PaymentProblem('cancelled', INVOICE_CANCELLED)
    if invoice is not None and capture_unsettled(invoice):
        raise PaymentProblem('not_payable', unsettled_message(invoice))
    if invoice is not None and invoice.organizer_changed_at is not None \
            and option.name != invoice_option(invoice).name:
        # An organizer changed it after the option was chosen: the page shows
        # another amount, so the registrant chooses again (DR-105).
        raise PaymentProblem('invoice_changed', INVOICE_CHANGED)
    if invoice is None:
        if option.amount <= 0:
            return None
        invoice = models.Invoice(
            registration=registration, origin=models.InvoiceOrigin.REGISTRATION)
    wanted = {'payment_type': payment_type, 'pending_paypal_order_id': None}
    if invoice.organizer_changed_at is None:
        wanted.update(description=option.title, amount=option.amount, handling=ZERO)
    if invoice.pk is not None and all(
            getattr(invoice, name) == value for name, value in wanted.items()):
        return invoice  # a repeat: nothing to change, nothing to log
    for name, value in wanted.items():
        setattr(invoice, name, value)
    if invoice.pk is None:
        invoice.save()
    else:
        invoice.save(update_fields=[*wanted, 'updated_at'])
    return invoice


def has_payments(invoice):
    return invoice is not None and models.Payment.all_objects.filter(invoice=invoice).exists()


def clear_unpaid_online_choice(registration):
    '''
    The registrant left a PayPal or Card payment unfinished and is confirmed
    without paying (finished to pay later, or walked away): they haven't
    settled on how to pay, so the registration invoice stops saying PayPal or
    Card (#759). Any pending order stays, for "Check PayPal order". One whose
    capture PayPal is still processing did pay that way (#767).
    '''
    invoice = registration_invoice(registration)
    if invoice is None or invoice.payment_type not in ONLINE_TYPES or has_payments(invoice) \
            or capture_processing(invoice):
        return
    invoice.payment_type = None
    invoice.save(update_fields=['payment_type', 'updated_at'])


# PayPal ---------------------------------------------------------------------------

class PaymentProblem(Exception):
    '''
    A payment that didn't go through. `code` says why, for the client:
    `amount_changed`, `declined`, `not_payable`, `cancelled` (the organizers
    cancelled the invoice) and `invoice_changed` (they changed it since the page
    was loaded) took no money; `unknown` may have (PayPal's answer was lost, or
    recording what PayPal did failed; the event has been emailed); `pending`
    did, but PayPal hasn't completed it, so it isn't recorded yet (#767). `detail`, if
    given, is what the event's email says went wrong instead of `message`;
    `doesnt_fit` marks a refund PayPal made that can't be this payment's, which
    a retry won't fix.
    '''
    status = {'amount_changed': 409, 'declined': 402, 'not_payable': 409,
              'not_approved': 409, 'mismatch': 400, 'unknown': 502, 'refused': 409,
              'not_configured': 409, 'cancelled': 409, 'invoice_changed': 409,
              'pending': 409}

    def __init__(self, code, message, detail=None, doesnt_fit=False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail
        self.doesnt_fit = doesnt_fit
        # PayPal doesn't know the order, or it isn't this invoice's (#767).
        self.not_this_order = False

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


def _order_payment_type(order):
    '''
    How PayPal says an order was paid, for when nothing else says: PayPal's
    Debit or Credit Card button can report a card payment as `paypal` (#758).
    '''
    source = (order or {}).get('payment_source') or {}
    if 'card' in source:
        return models.PaymentType.CARD
    return models.PaymentType.PAYPAL


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


def order_amounts(invoice):
    '''
    What a PayPal order for the invoice asks: `(due, fee)`, the fee being the
    handling it doesn't have yet (DR-88).
    '''
    due = invoice.amount_due
    fee = online_fee(invoice.registration.event, due) if money(invoice.handling) == 0 else ZERO
    return due, fee


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
    if capture_unsettled(invoice):
        raise PaymentProblem('not_payable', unsettled_message(invoice))
    due, fee = order_amounts(invoice)
    if due <= 0:
        raise PaymentProblem('not_payable', 'Nothing is due on this invoice.')
    value = due + fee
    text = item_text(invoice)
    # IMMEDIATE_PAYMENT_REQUIRED: PayPal takes only payments that complete at
    # capture (card, balance, instant bank transfer), not an eCheck that stays
    # PENDING for days (#767). It's set for the order, not in the newer
    # `payment_source.paypal.experience_context`, which would tie the order to
    # the PayPal wallet when the payer may have pressed another of PayPal's
    # buttons (Card, Venmo, Pay Later). A capture can still be PENDING for other
    # reasons (PayPal's review), so _captured checks every one.
    body = {
        'intent': 'CAPTURE',
        'purchase_units': [{
            'reference_id': str(invoice.registration.uuid),
            'custom_id': f'invoice:{invoice.id}',
            'description': text,
            'amount': {**_money_value(value), 'breakdown': {'item_total': _money_value(value)}},
            'items': [{'name': text, 'quantity': '1', 'unit_amount': _money_value(value)}],
        }],
        'application_context': {
            'shipping_preference': 'NO_SHIPPING',
            'payment_method': {'payee_preferred': 'IMMEDIATE_PAYMENT_REQUIRED'},
        },
    }
    try:
        order = paypal_client(event).create_order(body, request_id=uuid.uuid4().hex)
    except PayPalError as e:
        logger.error(f'PayPal order for invoice {invoice.id} failed: {e}')
        raise PaymentProblem('declined', 'PayPal couldn\'t start this payment. Please try again.')
    invoice.pending_paypal_order_id = order['id']
    # Its capture may be recorded days later, after the event's percent has
    # changed: the fee is the one this order asked (#767).
    invoice.paypal_order_fee = fee
    invoice.payment_type = payment_type
    invoice.save(update_fields=['pending_paypal_order_id', 'paypal_order_fee', 'payment_type',
                                'updated_at'])
    return order['id']


def record_capture(invoice, order, payment_type=None, notes=''):
    '''
    Record a captured PayPal order as a payment on the invoice, once: a capture
    already recorded (by its capture id) is returned as it is. The handling fee
    goes on the invoice now, as what was captured beyond what was due. Only
    for a capture PayPal has completed (`_capture_outcome`, #767).
    '''
    capture = _capture_of(order)
    if capture is None or not capture.get('id'):
        raise PaymentProblem('unknown', 'PayPal\'s reply has no capture.')
    existing = models.Payment.all_objects.filter(paypal_transaction_id=capture['id']).first()
    if existing is not None:
        return existing

    amount = money((capture.get('amount') or {}).get('value'))
    if money(invoice.handling) == 0:
        invoice.handling = _fee_captured(invoice, order, amount)
    # The button the payer pressed says how they paid; PayPal's order may not.
    payment_type = payment_type or invoice.payment_type or _order_payment_type(order)
    invoice.payment_type = payment_type
    invoice.pending_paypal_order_id = None
    invoice.paypal_order_fee = None
    invoice.save(update_fields=['handling', 'payment_type', 'pending_paypal_order_id',
                                'paypal_order_fee',
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


def _fee_captured(invoice, order, amount):
    '''
    The handling fee in the captured `amount` of the invoice's `order`: the
    one the order added to what was due then (DR-88), as kept when it was made
    (#767) — its capture may complete days later, after what's due or the
    event's percent changed. For an order made before that was kept, or
    another than the invoice's pending one (#804), what's due now says, unless
    it has changed since, when it's worked out from the amount: the order
    asked `due + online_fee(due)` for some due.
    '''
    if invoice.paypal_order_fee is not None and order.get('id') \
            and order['id'] == invoice.pending_paypal_order_id:
        return money(invoice.paypal_order_fee)
    event = invoice.registration.event
    due = invoice.amount_due
    if amount == due + online_fee(event, due):
        return online_fee(event, due)
    percent = Decimal(str(event.epayment_handling or 0))
    guess = money(amount / (1 + percent / 100))
    for cents in range(-3, 4):
        then = guess + cents * CENT
        if then > 0 and then + online_fee(event, then) == amount:
            return online_fee(event, then)
    return min(max(ZERO, amount - due), online_fee(event, due))


# A retry repeats the request id, so PayPal refunds at most once (DR-122).
REFUND_RETRY = ('Press "Refund through PayPal" again in this dialog: it repeats the same '
                'request, so PayPal won\'t refund twice, and the refund is recorded once.')
RECORDING_FAILED = {
    'capture': 'PayPal took your payment, but we couldn\'t record it. Please don\'t pay '
               'again: we\'ll check and let you know.',
    # Not "record it yourself": a refund recorded that way has no request id,
    # so a retry from the dialog would record PayPal's refund a second time.
    'refund': f'PayPal made the refund, but it couldn\'t be recorded here. {REFUND_RETRY}',
}
REFUND_DOESNT_FIT = ('PayPal\'s answer doesn\'t fit this payment, so the refund wasn\'t '
                     'recorded. Don\'t try it again (PayPal would answer the same way): check '
                     'the payment in PayPal. The event has been emailed the details.')


def _recording(what, record, *args):
    '''
    Record what PayPal just did (`what`: a capture or a refund). The money has
    moved, so a failure here (a database error, a bug) mustn't end in a bare
    500 that nobody hears of: it becomes `unknown`, whose handling undoes the
    half-done write (its transaction rolls back) and emails the event (#767).
    '''
    try:
        return record(*args)
    except PaymentProblem:
        raise
    except Exception as e:
        logger.exception(f'Recording a PayPal {what} failed')
        raise PaymentProblem('unknown', RECORDING_FAILED[what],
                             detail=f'PayPal did it, but recording it failed: {e!r}') from e


def _order_amount(order):
    return money((_first_unit(order).get('amount') or {}).get('value'))


def capture_paypal_order(invoice, order_id, payment_type, notes='', request=None):
    '''
    Check the PayPal order the payer approved and capture it (DR-90): the
    money moves only here, and only for what the invoice asks now. An order
    already captured is recorded (or returned) instead of captured again.
    Raises PaymentProblem when it doesn't go through; when PayPal's answer is
    lost the order stays pending and the event is emailed the details. A
    capture PayPal hasn't completed raises `pending`: nothing is recorded, and
    the order stays pending until the worker finds PayPal has completed it.
    '''
    if capture_processing(invoice):
        # PayPal already has this invoice's payment, pending: a repeat of its
        # capture mustn't disturb the watch over it (#767).
        raise PaymentProblem('pending', CAPTURE_PENDING)
    # The views call this with no transaction open, so each write here commits
    # before they go on (#804). This one first: should the process die after
    # PayPal takes the money and before it's recorded, the worker still finds
    # the order (check_unrecorded_captures), even once another is pending. Not
    # over a watch a request just ahead of this one began (#767).
    models.Invoice.all_objects.filter(
        pk=invoice.pk, pending_paypal_order_id=order_id, paypal_capture_pending_at__isnull=True,
    ).update(paypal_capture_order_id=order_id, paypal_capture_started_at=timezone.now())
    try:
        # Then the capture, all or nothing: once PayPal has the money, the
        # payment is on record whatever the caller does next.
        with transaction.atomic():
            _lock_registration_of(invoice)
            locked = models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)
            if capture_processing(locked):
                # The look above saw the invoice from before that request
                # marked it pending: this one leaves it alone.
                raise PaymentProblem('pending', CAPTURE_PENDING)
            payment = _capture(locked, order_id, payment_type, notes)
            if payment is not None:
                _capture_settled(invoice, order_id)
    except PaymentProblem as problem:
        if problem.code == 'pending':
            pass  # PayPal is processing it: the watch over it stays
        elif problem.code == 'unknown':
            # The block above rolled back anything half recorded; with no
            # transaction open around this call, the report commits (#767).
            send_paypal_problem_report(
                invoice, what='capture', error=problem.detail or problem.message,
                order_id=order_id, payment_type=payment_type, request=request)
        else:
            _capture_settled(invoice, order_id)  # PayPal said no: no money moved
        raise
    if payment is None:
        raise PaymentProblem('pending', CAPTURE_PENDING)
    return payment


def _capture_settled(invoice, order_id, started_at=None):
    '''
    The capture of `order_id` has an outcome: the worker needn't ask about it.
    With `started_at`, only that attempt (a retry since started another).
    Returns whether it settled it (it hadn't been meanwhile).
    '''
    match = {'paypal_capture_order_id': order_id}
    if started_at is not None:
        match['paypal_capture_started_at'] = started_at
    return models.Invoice.all_objects.filter(pk=invoice.pk, **match).update(
        paypal_capture_order_id=None, paypal_capture_started_at=None,
        paypal_capture_pending_at=None) > 0


def capture_unsettled(invoice, now=None):
    '''
    A capture on the invoice started and has no outcome yet: PayPal may have
    taken the money, so no other payment starts, and the invoice is neither
    cancelled nor deleted, until it's known (the worker asks 15 minutes on, for
    a day), and its mark isn't overwritten by another order's (#804). One
    PayPal says is pending holds the invoice until it's settled, after the
    worker's month of asking too ("Check PayPal order"; #767).
    '''
    return capture_processing(invoice) or _watched(invoice, now or timezone.now())


def capture_processing(invoice):
    '''
    PayPal captured a payment on the invoice and is still processing it, as
    far as we know: until the worker or "Check PayPal order" finds PayPal has
    completed or declined it, however long that takes (#767).
    '''
    return invoice is not None and invoice.paypal_capture_order_id is not None \
        and invoice.paypal_capture_started_at is not None \
        and invoice.paypal_capture_pending_at is not None


def capture_watch_lapsed(invoice, now=None):
    '''
    PayPal is processing a payment on the invoice, and has been for longer than
    the worker asks about it: only "Check PayPal order" asks now (#767).
    '''
    return capture_processing(invoice) and not _watched(invoice, now or timezone.now())


def _watched(invoice, now):
    '''The worker still asks about the invoice's capture: for a day, or a month if pending.'''
    if invoice.paypal_capture_order_id is None or invoice.paypal_capture_started_at is None:
        return False
    waited_for = PENDING_CAPTURE_WATCHED_FOR if invoice.paypal_capture_pending_at is not None \
        else UNRECORDED_CAPTURE_RETRIES_FOR
    return invoice.paypal_capture_started_at >= now - waited_for


def unsettled_message(invoice):
    '''Why no other payment can start on an invoice whose capture is unsettled.'''
    return CAPTURE_PENDING if invoice.paypal_capture_pending_at is not None \
        else CAPTURE_UNSETTLED


def held_message(invoice, refused):
    '''
    Why an invoice whose capture is unsettled is `refused` something ("it
    can't be cancelled"): PayPal may record a payment on it yet, as what it
    asked when the order was made (#767).
    '''
    if invoice.paypal_capture_pending_at is not None:
        return (f'PayPal is still processing a payment on this invoice, so {refused} until '
                'PayPal completes or declines it. "Check PayPal order" asks PayPal where it '
                'stands.')
    return (f'A PayPal payment on this invoice is still being confirmed, so {refused} until '
            'that\'s known. "Check PayPal order" asks PayPal now.')


def _capture_outcome(order):
    '''
    What PayPal's capture of the order came to: `completed` (the money reached
    the event — PayPal's order says COMPLETED even when the capture is pending
    or declined, so the capture is what counts), `pending` (captured, but
    PayPal hasn't completed it and may yet deny it), or None (not captured, or
    declined or failed: no money moved).
    '''
    status = _capture_status(order)
    if status in CAPTURED:
        return 'completed'
    if status == 'PENDING':
        return 'pending'
    return None


def _capture_status(order):
    return (_capture_of(order) or {}).get('status')


def _capture_pending(invoice, order, payment_type=None, now=None):
    '''
    PayPal captured the (locked) invoice's order but hasn't completed the
    capture: nothing is recorded. The order stays pending on the invoice, which
    takes no other payment meanwhile, and is marked for the worker to ask about
    every half hour until PayPal completes the capture (then it's recorded) or
    doesn't (#767). A watch that had lapsed ("Check PayPal order" a month on)
    starts again.
    '''
    now = now or timezone.now()
    if invoice.paypal_capture_order_id != order['id'] or not _watched(invoice, now):
        invoice.paypal_capture_order_id = order['id']
        invoice.paypal_capture_started_at = now
    invoice.paypal_capture_pending_at = now
    invoice.pending_paypal_order_id = order['id']
    invoice.payment_type = payment_type or invoice.payment_type or _order_payment_type(order)
    invoice.save(update_fields=[
        'paypal_capture_order_id', 'paypal_capture_started_at', 'paypal_capture_pending_at',
        'pending_paypal_order_id', 'payment_type', 'updated_at'])
    logger.warning(f'PayPal order {order["id"]} for invoice {invoice.id} is captured but '
                   f'pending ({_pending_reason(order)}); not recorded until PayPal completes it')


def _pending_reason(order):
    capture = _capture_of(order) or {}
    return (capture.get('status_details') or {}).get('reason') or 'no reason given'


def _lock_registration_of(invoice):
    '''
    Lock the invoice's registration, before the invoice: the registration's
    payment steps take it first, so none of them can rewrite the invoice
    while it's being paid, and none waits on a lock the other holds.
    '''
    models.Registration.all_objects.select_for_update().filter(pk=invoice.registration_id).first()


def locked_invoice(invoice):
    '''
    The invoice as committed, its row held until the transaction ends (its
    registration's first, as every payment step takes them): so whether a
    capture holds it can't change while a payment is added to it (#767).
    '''
    _lock_registration_of(invoice)
    return models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)


def _capture(invoice, order_id, payment_type, notes):
    '''
    Capture the order and record what PayPal captured: the payment, or None
    when the capture is pending (`_capture_pending`).
    '''
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
        return _captured(invoice, order, payment_type, notes)
    if status != 'APPROVED':
        raise PaymentProblem('not_approved', 'PayPal hasn\'t approved this payment.')
    if order_id != invoice.pending_paypal_order_id or invoice.cancelled_at is not None:
        raise PaymentProblem('not_payable', 'This invoice isn\'t waiting for that payment.')
    due, fee = order_amounts(invoice)
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
            try:
                order = client.fetch_order_details(order_id)
            except PayPalError as fetch_error:
                # Captured, but what it captured is unknown: report it (#767).
                raise PaymentProblem('unknown', str(fetch_error))
            return _captured(invoice, order, payment_type, notes)
        raise PaymentProblem('declined', DECLINED)
    return _captured(invoice, captured, payment_type, notes)


def _captured(invoice, order, payment_type, notes):
    '''
    PayPal's captured order, recorded only once PayPal has completed the
    capture; a pending one is left for the worker (None), and one declined or
    failed took no money (#767).
    '''
    outcome = _capture_outcome(order)
    if outcome == 'completed':
        return _recording('capture', record_capture, invoice, order, payment_type, notes)
    if outcome == 'pending':
        _recording('capture', _capture_pending, invoice, order, payment_type)
        return None
    raise PaymentProblem('declined', DECLINED)


def check_paypal_order(invoice):
    '''
    A registrar's "Check PayPal order": ask PayPal about the invoice's pending
    order; record it if PayPal captured it and completed the capture, keep it
    pending if the capture is still pending (#767), else clear it (no money was
    taken). A capture of it that hadn't settled now has, unless it's still
    pending (#804). Returns `(result, payment)`: `recorded`, `pending` or
    `not_captured`. When PayPal doesn't know the order, or it isn't this
    invoice's, it's a `mismatch`, and a capture of it is settled as the worker
    settles one: else a held invoice would stay held (#767).
    '''
    order_id = invoice.pending_paypal_order_id
    if not order_id:
        raise PaymentProblem('not_payable', 'No PayPal order is waiting on this invoice.')
    try:
        return _check_paypal_order(invoice, order_id)
    except PaymentProblem as problem:
        if problem.not_this_order and _capture_settled(invoice, order_id) \
                and invoice.paypal_capture_pending_at is not None:
            # As the worker's `capture_lost` email says (#767).
            raise PaymentProblem(problem.code, (
                f'{problem.message.rstrip(".")}. PayPal had this payment as pending, but no '
                'longer finds it as this invoice\'s order, so the invoice can be paid again. '
                'Look the order up in your PayPal dashboard. If PayPal took the money, record '
                'the payment by hand.'), detail=problem.detail) from problem
        raise


def _check_paypal_order(invoice, order_id):
    with transaction.atomic():
        # The registration first, as every payment step takes them: recording
        # the payment needs it, and the other order would deadlock (#819).
        _lock_registration_of(invoice)
        invoice = models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)
        try:
            order = paypal_client(invoice.registration.event).fetch_order_details(order_id)
        except PayPalError as e:
            problem = PaymentProblem('unknown' if e.unknown else 'mismatch', str(e))
            problem.not_this_order = e.status == 404
            raise problem
        try:
            _check_belongs(invoice, order)
        except PaymentProblem as problem:
            problem.not_this_order = True
            raise
        outcome = _capture_outcome(order)
        if outcome == 'pending':
            _capture_pending(invoice, order)
            return 'pending', None
        _capture_settled(invoice, order_id)
        if outcome == 'completed':
            return 'recorded', record_capture(invoice, order, invoice.payment_type,
                                              'Recorded by checking PayPal')
        invoice.pending_paypal_order_id = None
        invoice.save(update_fields=['pending_paypal_order_id', 'updated_at'])
        return 'not_captured', None


def check_unrecorded_captures(now=None):
    '''
    The worker's sweep (#804): ask PayPal about each order whose capture
    started over 15 minutes ago and never settled (the process may have died
    after PayPal took the money), and record it if PayPal captured it, even
    when another order has been made pending on the invoice since. An order
    PayPal says wasn't captured, doesn't know, or isn't this invoice's is
    settled: it's asked about once, and stays pending for "Check PayPal order"
    if it still is. Anything less definite (PayPal down, busy, or refusing our
    credentials) is asked again next time, for a day. A capture PayPal says
    is pending is asked about every half hour for a month, and recorded once
    PayPal completes it (#767); asked once after the month, one still pending
    is reported and left held for "Check PayPal order". A few are asked each
    run. Returns how many it recorded.
    '''
    now = now or timezone.now()
    unrecorded = Q(paypal_capture_pending_at__isnull=True,
                   paypal_capture_started_at__lt=now - UNRECORDED_CAPTURE_AFTER,
                   paypal_capture_started_at__gte=now - UNRECORDED_CAPTURE_RETRIES_FOR)
    # Last asked about during its watch: so once more after the watch, to
    # report one PayPal still hasn't completed, and then no more.
    pending = Q(paypal_capture_pending_at__lt=now - PENDING_CAPTURE_ASK_EVERY) & Q(
        paypal_capture_pending_at__lt=F('paypal_capture_started_at')
        + PENDING_CAPTURE_WATCHED_FOR)
    unsettled = models.Invoice.all_objects.filter(
        paypal_capture_order_id__isnull=False).filter(unrecorded | pending)
    recorded = 0
    # A few per run, in no fixed order: each PayPal call may take a minute when
    # PayPal is struggling, and the reconciler mustn't look stuck, nor marks
    # that keep failing hold up the rest. The others wait for the next run.
    some = unsettled.select_related('registration__event').order_by('?')
    for invoice in some[:UNRECORDED_CAPTURES_PER_RUN]:
        try:
            recorded += _record_unrecorded_capture(invoice, now)
        except Exception:
            logger.exception(f'Checking PayPal order {invoice.paypal_capture_order_id} for '
                             f'invoice {invoice.id} failed; trying again next time')
        still_working()
    return recorded


def _asked(invoice, order_id, started_at, now):
    '''
    Note that PayPal said the capture is pending at `now`, unless it was
    settled or watched again meanwhile; returns whether it noted it.
    '''
    return models.Invoice.all_objects.filter(
        pk=invoice.pk, paypal_capture_order_id=order_id, paypal_capture_started_at=started_at,
    ).update(paypal_capture_pending_at=now) > 0


def _record_unrecorded_capture(invoice, now):
    '''
    The sweep's check of one order. PayPal is asked with nothing locked; only
    recording what it captured takes the locks. Returns whether it recorded it.
    '''
    order_id = invoice.paypal_capture_order_id
    started_at = invoice.paypal_capture_started_at
    about = f'PayPal order {order_id} for invoice {invoice.id}'
    # The payer was told not to pay again (it's processing, or couldn't be
    # confirmed): news that it isn't coming goes to the event too (#767),
    # unless "Check PayPal order" settled it, or began another watch, while
    # PayPal was being asked.
    was_pending = invoice.paypal_capture_pending_at is not None
    watch_ended = was_pending and started_at < now - PENDING_CAPTURE_WATCHED_FOR

    def settle(what, error):
        if _capture_settled(invoice, order_id, started_at) and was_pending:
            report(what, error)

    def report(what, error):
        send_paypal_problem_report(invoice, what=what, error=error, order_id=order_id,
                                   payment_type=invoice.payment_type,
                                   watch_started_at=started_at)

    def watch_over(error):
        # Asked at `now`, past its watch, it isn't asked again; it stays held,
        # since PayPal may still complete it, until a registrar checks it.
        if _asked(invoice, order_id, started_at, now):
            report('capture_expired', error)

    try:
        order = paypal_client(invoice.registration.event).fetch_order_details(order_id)
    except PayPalError as e:
        if e.status != 404:
            if watch_ended:
                # Its last ask, unanswered: reported as one still pending.
                logger.warning(f'Checking {about}: {e}; no longer asked about')
                watch_over(f'PayPal couldn\'t be asked about it: {e}')
            elif was_pending:
                # Asked again in half an hour, as if it had answered: not every
                # minute, crowding out the others (#767).
                _asked(invoice, order_id, started_at, now)
                logger.warning(f'Checking {about}: {e}; trying again in half an hour')
            else:
                logger.warning(f'Checking {about}: {e}; trying again next time')
            return False
        logger.error(f'Checking {about}: PayPal doesn\'t know it; left for "Check PayPal order"')
        settle('capture_lost', str(e))
        return False
    try:
        _check_belongs(invoice, order)
    except PaymentProblem as problem:
        logger.error(f'Checking {about}: {problem}; left for "Check PayPal order"')
        settle('capture_lost', str(problem))
        return False
    outcome = _capture_outcome(order)
    if outcome == 'pending':
        # Still pending: asked again in half an hour, while the watch lasts;
        # after it, reported once (#767).
        if watch_ended:
            watch_over(f'PayPal capture status: PENDING ({_pending_reason(order)})')
        else:
            _asked(invoice, order_id, started_at, now)
            logger.info(f'Checking {about}: its capture is still pending '
                        f'({_pending_reason(order)})')
        return False
    if outcome != 'completed':
        # PayPal denied a capture it had said was pending: no money moved. The
        # order stays for "Check PayPal order".
        status = _capture_status(order) or 'not captured'
        settle('capture_denied', f'PayPal capture status: {status}')
        return False
    capture_id = (_capture_of(order) or {}).get('id')
    with transaction.atomic():
        _lock_registration_of(invoice)
        locked = models.Invoice.all_objects.select_for_update().get(pk=invoice.pk)
        # Recorded meanwhile (the payer's retry, "Check PayPal order"): nothing to add.
        known = bool(capture_id) and models.Payment.all_objects.filter(
            paypal_transaction_id=capture_id).exists()
        record_capture(locked, order, locked.payment_type, 'Recorded by the worker checking PayPal')
        _capture_settled(invoice, order_id)
    if known:
        return False
    logger.warning(f'{about} was captured but never recorded; recorded it now')
    return True


def refund_paypal_payment(payment, amount, reason, request_id, request=None):
    '''
    Refund some or all of a PayPal or card payment through PayPal (DR-94), and
    record the refund as a negative payment on the same invoice, for what
    PayPal says it refunded. A retry with the same `request_id` gets the
    refund back, recorded once: the one already recorded with that request id
    (refused if it asks for another amount), or else PayPal's first refund.
    Call it outside a transaction: the email about an unknown outcome is
    written after this one's rollback, and must not be undone with it.
    '''
    amount = money(amount)
    try:
        with transaction.atomic():
            return _refund(lock_payment(payment), amount, reason, request_id)
    except PaymentProblem as problem:
        if problem.code == 'unknown':
            send_paypal_problem_report(
                payment.invoice, what='refund', error=problem.detail or problem.message,
                capture_id=capture_id_of(payment), request_id=request_id, amount=amount,
                payment_type=payment.payment_type, refund_of=payment,
                doesnt_fit=problem.doesnt_fit, request=request)
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
    # A retry of a refund already recorded gets it back, before the amount
    # check could refuse it for having used up what was left — unless it asks
    # for another amount, which that refund didn't give back.
    retried = models.Payment.all_objects.filter(
        refund_of=payment, refund_request_id=request_id).first()
    if retried is not None:
        if money(-retried.amount) != amount:
            raise PaymentProblem(
                'refused', f'This refund was already made, for ${money(-retried.amount):.2f}. '
                'To refund a different amount, start a new refund.')
        return retried
    if amount <= 0 or amount > refundable(payment):
        raise PaymentProblem(
            'refused', f'You can refund up to ${refundable(payment):.2f} of this payment.')
    try:
        reply = paypal_client(payment.registration.event).refund_capture(
            capture_id, f'{amount:.2f}', reason, request_id=f'refund-{request_id}')
    except PayPalError as e:
        if e.unknown:
            raise PaymentProblem('unknown', f'{e}. PayPal may have made the refund. '
                                 f'{REFUND_RETRY}', detail=str(e))
        raise PaymentProblem('refused', f'PayPal refused the refund: {e}')
    refund_id = (reply or {}).get('id')
    if not refund_id:
        raise PaymentProblem('unknown', 'PayPal\'s reply has no refund id.')
    return _recording('refund', record_refund, payment, amount, reason, request_id, reply)


def record_refund(payment, amount, reason, request_id, reply):
    '''
    Record PayPal's refund of the payment, once (by its refund id), with the
    request id it was made with. The amount is PayPal's: a request id it has
    seen before gets the earlier refund back, which may have been for another
    amount when that refund's reply was lost and so never recorded (#767).
    A reply that can't be this payment's refund — of another capture, or for
    more than is left of it — isn't recorded but reported, as the money moved.
    '''
    capture_id = capture_id_of(payment)
    of = _refunded_capture(reply)
    if of is not None and of != capture_id:
        raise PaymentProblem('unknown', REFUND_DOESNT_FIT, doesnt_fit=True, detail=(
            f'PayPal\'s reply is refund {reply["id"]} of capture {of}, not of this '
            f'payment\'s capture {capture_id}, so it wasn\'t recorded.'))
    existing = models.Payment.all_objects.filter(paypal_transaction_id=reply['id']).first()
    if existing is not None:
        return existing
    refunded_amount = (reply.get('amount') or {}).get('value')
    if refunded_amount is not None:
        amount = money(refunded_amount)
    left = refundable(payment)
    if amount <= 0 or amount > left:
        raise PaymentProblem('unknown', REFUND_DOESNT_FIT, doesnt_fit=True, detail=(
            f'PayPal says refund {reply["id"]} gave back ${amount:.2f}, but ${left:.2f} is '
            'left of this payment, so it wasn\'t recorded.'))
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
        refund_request_id=request_id,
        paypal_response=reply,
        paypal_transaction_id=reply['id'],
        notes=notes,
    )


def _refunded_capture(reply):
    '''
    The id of the capture PayPal's refund reply says it refunds — the last part
    of its `up` link (`…/v2/payments/captures/{id}`) — or None if it doesn't say.
    '''
    for link in reply.get('links') or []:
        if isinstance(link, dict) and link.get('rel') == 'up':
            return str(link.get('href') or '').split('?')[0].rstrip('/').rsplit('/', 1)[-1]
    return None


# Telling the organizer ------------------------------------------------------------

PENDING_CAPTURE_NEWS = ('capture_denied', 'capture_expired', 'capture_lost')


def paypal_problem_report(invoice, *, what, error, order_id=None, capture_id=None,
                          request_id=None, amount=None, payment_type=None, refund_of=None,
                          doesnt_fit=False, watch_started_at=None, request=None):
    '''
    The subject and plain-text body of a PayPal problem email (SPEC §9.7):
    `what` is `capture` or `refund` (an outcome unknown), or news of a capture
    PayPal had said was pending (`PENDING_CAPTURE_NEWS`; #767).
    '''
    registration = invoice.registration
    event = registration.event
    campers = ', '.join(
        ' '.join(filter(None, [(c.attributes or {}).get('first_name'),
                               (c.attributes or {}).get('last_name')])) or f'Camper #{c.id}'
        for c in registration.campers.all())
    noun = 'refund' if what == 'refund' else 'payment'
    subject = (f'PayPal {noun} needs checking — Registration #{registration.id}, '
               f'Invoice #{invoice.id}')
    if what == 'refund' and doesnt_fit:
        happened = ('PayPal made a refund, but its answer doesn\'t fit this payment (see the '
                    'error), so it wasn\'t recorded. The money has been returned to the payer.')
    elif what == 'refund':
        happened = ('We asked PayPal to refund this payment but got no clear answer. '
                    'The money may have been returned to the payer.')
    elif what == 'capture_denied':
        happened = ('PayPal took this payment as pending, then didn\'t complete it. No money '
                    'was received, nothing was recorded, and the invoice can be paid again.')
    elif what == 'capture_expired':
        happened = (f'PayPal took this payment as pending, and {PENDING_CAPTURE_WATCHED_FOR.days} '
                    'days on still hadn\'t told us it completed it (see the error). Nothing has '
                    'been recorded, and '
                    'we no longer ask PayPal about it. PayPal may still complete it, so until '
                    'someone checks the order the invoice takes no other payment and can\'t be '
                    'cancelled or deleted.')
    elif what == 'capture_lost':
        happened = ('PayPal took this payment as pending, but now no longer finds it as this '
                    'invoice\'s order (see the error). Nothing has been recorded, we no longer '
                    'ask PayPal about it, and the invoice can be paid again.')
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
    if what == 'capture_expired' and watch_started_at is not None:
        lines.append(f'Asked about since: '
                     f'{timezone.localtime(watch_started_at):%Y-%m-%d %H:%M %Z}')
    lines.append('')
    if what == 'refund' and doesnt_fit:
        lines += [
            'What to do',
            '1. Don\'t press "Refund through PayPal" again for it: PayPal answers the same '
            'request the same way.',
            '2. Look up the refund and the capture in your PayPal dashboard, work out which '
            'payment it gave money back from and how much, and put the ledger right (a refund '
            'recorded by hand for the same money, say), then record it by hand.',
        ]
    elif what in PENDING_CAPTURE_NEWS:
        lines += [
            'What the registrant was told',
            # Which, depends on what PayPal answered when they paid: the
            # worker may have found the capture pending after a lost answer.
            'Not to pay again: that their payment is processing and is recorded once PayPal '
            'completes it, or, if PayPal\'s answer was lost when they paid, that we couldn\'t '
            'confirm it with PayPal and would check.',
            '',
            'What to do',
        ]
        if what == 'capture_denied':
            lines += [
                '1. Let the registrant know their payment didn\'t go through. They can pay '
                'again by check, or online from the invoice\'s pay link.',
                '2. "Check PayPal order" on the invoice clears the order.',
            ]
        elif what == 'capture_lost':
            lines += [
                '1. Look the order up in your PayPal dashboard. If PayPal took the money, '
                'record the payment on the invoice by hand.',
                '2. If it didn\'t, let the registrant know their payment didn\'t go through. '
                'They can pay again by check, or online from the invoice\'s pay link.',
            ]
        else:
            lines += [
                '1. Look the order up in your PayPal dashboard. Some pending payments need you '
                'to accept or refuse them there.',
                '2. Press "Check PayPal order" on the invoice. It records the payment if PayPal '
                'has completed it, or clears the order if PayPal declined it (the invoice can '
                'then be paid again); if it\'s still pending, it\'s asked about for another '
                f'{PENDING_CAPTURE_WATCHED_FOR.days} days.',
            ]
    elif what == 'refund':
        lines += [
            'What to do',
            '1. Ask whoever made the refund to press "Refund through PayPal" again in the '
            'same dialog. It repeats the same request (the request id above), so PayPal '
            'refunds at most once, and the refund is recorded once.',
            '2. Only if that dialog was closed: look up the capture in your PayPal dashboard. '
            'If PayPal made the refund, record it on the invoice by hand; if it didn\'t, '
            'refund it again. Recorded by hand, a retry from a dialog still open would '
            'record it a second time.',
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
    unknown, or news of a capture PayPal had said was pending (it denied it,
    still hasn't completed it, or no longer finds it: `PENDING_CAPTURE_NEWS`),
    once per order (or refund request), kind of news and watch over the
    capture; always logged as an error.
    '''
    subject, body = paypal_problem_report(invoice, **details)
    logger.error(f'{subject}\n{body}')
    key = details.get('order_id') or details.get('request_id') or str(invoice.id)
    if details.get('doesnt_fit'):
        # A retry that finds PayPal's refund doesn't fit, after one whose
        # recording failed: the event was told the retry records it (#767).
        key = f'{key}:doesnt-fit'
    if details.get('what') in PENDING_CAPTURE_NEWS:
        # Not the same news as an earlier lost answer about the order, nor as
        # the end of an earlier watch over it ("Check PayPal order" began
        # this one; #767).
        key = f'{key}:{details["what"]}'
        if details.get('watch_started_at') is not None:
            key = f'{key}:{details["watch_started_at"].isoformat()}'
    queued = queue_report(
        invoice.registration, models.EmailMessageKind.PAYMENT_REPORT, subject, body,
        dedupe_key=f'paypal-problem:{key}')
    if not queued:
        logger.error(f'No PayPal problem email sent for invoice {invoice.id}: '
                     'the event has no confirmation_email_from address.')
    return queued
