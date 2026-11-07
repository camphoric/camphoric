'''
Each organization's contract, and the gate it puts in front of the
organization (SPEC §5, §6; §15 DR-145).

An organization's contract is a series of versions, each one Markdown
document whose headings are its sections (DR-153). A version is drafted, then
published, and can't change after that. Its latest version is also public.
Someone signed in needs to agree with an organization while it has a published
version they haven't agreed to; until they do, the API refuses whatever reaches
that organization or what belongs to it (403, code `contract_agreement_required`,
with the organization's id). An organization with nothing published has no gate.

Users aren't tied to organizations (DR-50), so which organization a request
reaches comes from what it names: a record (its organization, by
ORGANIZATION_PATHS), an id in the URL (URL_KWARGS), an id in the query string
or body (NAMED_RECORDS), or any record a serializer resolves from what's sent
(`check_related`, from camphoric.serializers). Lists that name none leave out
the records of organizations the user still has to agree with
(`ContractGateFilterBackend`, `exclude_pending`). The permission classes
(camphoric.permissions) call the checks here, so every view behind a Camphoric
role is gated unless it says `skips_contract_gate`.

People are asked to agree when they sign in, to every organization pending, in
turn (§15 DR-151): by the admin client after `/api/login`, and by its OAuth
consent page, before which no app gets a code (camphoric.oauth_views). So publishing a
version ends everyone's sign-ins (`end_sign_ins`): web sessions but the
publisher's own, and every app's access, so each person meets the new version
when they next sign in, and each app when its person connects it again. The
gate stays, as the backstop.
'''

import hashlib
import ipaddress
from importlib import import_module

from django.conf import settings
from django.contrib.auth import SESSION_KEY
from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Max, Model, OuterRef, Q, Subquery
from django.db.models.functions import Lower
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import BaseFilterBackend
from rest_framework.throttling import BaseThrottle

from camphoric import models

CONTRACT_AGREEMENT_REQUIRED = 'contract_agreement_required'


# --- Which organization a record belongs to ---------------------------------------

# The lookup from a record to its organization's id, by model, or the lookups
# when it may belong to one by more than one way. A model left out belongs to
# no organization (users, say), so it's never gated.
ORGANIZATION_PATHS = {
    models.Organization: 'pk',
    models.EmailAccount: 'organization',
    models.Event: 'organization',
    models.RegistrationType: 'event__organization',
    models.PromoCode: 'event__organization',
    models.Registration: 'event__organization',
    models.RegistrationDraft: 'event__organization',
    models.Report: 'event__organization',
    models.Lodging: 'event__organization',
    models.CustomChargeType: 'event__organization',
    models.Deposit: 'event__organization',
    models.EmailTemplate: 'event__organization',
    models.EmailBatch: 'event__organization',
    # By its event, or the account it's sent with (an account's test message
    # has no event); a password link has neither, and belongs to no organization.
    models.EmailMessage: ('event__organization', 'account__organization'),
    models.EmailUnsubscribe: 'event__organization',
    models.EditLease: 'event__organization',
    models.Invitation: 'registration_type__event__organization',
    models.Camper: 'registration__event__organization',
    models.Invoice: 'registration__event__organization',
    models.Payment: 'registration__event__organization',
    models.PricingOverride: 'registration__event__organization',
    models.CustomCharge: 'custom_charge_type__event__organization',
    models.Contract: 'organization',
    models.ContractAgreement: 'organization',
}

# Ids a URL names, by its keyword, and what they're ids of.
URL_KWARGS = {
    'event_id': models.Event,
    'report_id': models.Report,
    'invitation_id': models.Invitation,
}

# Ids a request may name in its query string or body, by name, and what
# they're ids of. Only names that mean the same everywhere in the API.
NAMED_RECORDS = {
    'organization': models.Organization,
    'event': models.Event,
    'registration__event': models.Event,
    'registration_type__event': models.Event,
    'custom_charge_type__event': models.Event,
    'registration': models.Registration,
    'registration_type': models.RegistrationType,
    'camper': models.Camper,
    'custom_charge_type': models.CustomChargeType,
    'invoice': models.Invoice,
    'lodging': models.Lodging,
    'account': models.EmailAccount,
}


def organization_paths(model):
    '''The lookups from one of the model's records to its organization; none for none.'''
    for cls in model.__mro__:
        if cls in ORGANIZATION_PATHS:
            paths = ORGANIZATION_PATHS[cls]
            return (paths,) if isinstance(paths, str) else paths
    return ()


def _follow(record, path):
    if path == 'pk':
        return record.pk
    *hops, last = path.split('__')
    for hop in hops:
        record = getattr(record, hop, None)
        if record is None:
            return None
    return getattr(record, f'{last}_id', None)


def organization_ids_of(record):
    '''The ids of the organizations the record belongs to: one, or none.'''
    ids = {_follow(record, path) for path in organization_paths(type(record))}
    return ids - {None}


def records_named(model, value):
    '''
    The records `value` names as ids, read as the API reads them (a list of
    ids, "+5", 5.0): what a lookup by it would find. None when it names none.
    '''
    values = value if isinstance(value, (list, tuple)) else [value]
    pks = []
    for item in values:
        if isinstance(item, (dict, list, tuple)) or item is None:
            continue
        try:
            pks.append(model._meta.pk.to_python(item))
        except (DjangoValidationError, TypeError, ValueError):
            continue
    return list(model._base_manager.filter(pk__in=pks)) if pks else []


def pending_q(model, pending):
    '''A filter matching the model's records that belong to one of `pending`.'''
    condition = Q()
    for path in organization_paths(model):
        condition |= Q(**{f'{path}__in': pending})
    return condition


# --- Who needs to agree -------------------------------------------------------------

def latest_contracts():
    '''Each organization's latest published version.'''
    latest_number = (models.Contract.objects
                     .filter(organization=OuterRef('organization'), published_at__isnull=False)
                     .order_by('-number').values('number')[:1])
    return models.Contract.objects.filter(
        published_at__isnull=False, number=Subquery(latest_number))


def latest_contract(organization_id):
    return (models.Contract.objects
            .filter(organization_id=organization_id, published_at__isnull=False)
            .order_by('-number').first())


_UNSET = object()


def pending_organization_ids(user):
    '''
    The ids of the organizations whose latest version the user hasn't agreed
    to, in the order they're asked to agree: by the organizations' names. Empty
    for someone not signed in.
    '''
    if user is None or not user.is_authenticated:
        return []
    # Cached on the user object: a request checks it more than once.
    pending = getattr(user, '_camphoric_pending_contracts', _UNSET)
    if pending is _UNSET:
        pending = list(latest_contracts()
                       .exclude(agreements__user=user)
                       .order_by(Lower('organization__name'), 'organization__name',
                                 'organization_id')
                       .values_list('organization_id', flat=True))
        user._camphoric_pending_contracts = pending
    return pending


def forget_pending(user):
    # An attribute, not the instance's __dict__: a session's request.user is a
    # lazy wrapper, which passes deleting on to the user it wraps.
    try:
        del user._camphoric_pending_contracts
    except AttributeError:
        pass


def agreement_required(organization_id):
    '''
    What a refusal for the organization's terms answers (403): the code, the
    organization by id and by name, and a `detail` and `contract_url` (where to
    sign in and agree; null without CAMPHORIC_PUBLIC_URL) that a script can
    print as they are (DR-145, DR-157).
    '''
    from camphoric.templating.urls import admin_url

    name = models.Organization.objects.filter(pk=organization_id) \
        .values_list('name', flat=True).first() or 'This organization'
    return {
        'detail': f'{name} has new terms to agree to. Sign in to Camphoric to agree to '
                  'them, then try again.',
        'code': CONTRACT_AGREEMENT_REQUIRED,
        'organization': organization_id,
        'organization_name': name,
        'contract_url': admin_url('/admin') or None,
    }


class ContractAgreementRequired(PermissionDenied):
    '''403: the user has yet to agree to the organization's latest version.'''

    def __init__(self, organization_id):
        super().__init__()
        # Kept as given: DRF would make the id a string.
        self.detail = agreement_required(organization_id)


def check_organization(request, organization_id):
    '''Refuse the request (403) when the user still has to agree with the organization.'''
    if organization_id is not None and \
            organization_id in pending_organization_ids(request.user):
        raise ContractAgreementRequired(organization_id)


def check_record(request, record):
    for organization_id in organization_ids_of(record):
        check_organization(request, organization_id)


def check_related(request, data):
    '''
    Refuse writing a reference to a record of an organization the user still
    has to agree with: every record in `data` (a serializer's validated data,
    lists and nested data included).
    '''
    if request is None or not pending_organization_ids(getattr(request, 'user', None)):
        return
    if isinstance(data, Model):
        check_record(request, data)
    elif isinstance(data, dict):
        for value in data.values():
            check_related(request, value)
    elif isinstance(data, (list, tuple, set)):
        for value in data:
            check_related(request, value)


def exclude_pending(queryset, user):
    '''The queryset without the records of organizations the user still has to agree with.'''
    pending = pending_organization_ids(user)
    if not pending or not organization_paths(queryset.model):
        return queryset
    return queryset.exclude(pending_q(queryset.model, pending))


def exclude_pending_log_entries(entries, user):
    '''
    Audit log entries without those of records that belong to organizations the
    user still has to agree with. (A record since deleted outright can't be
    told apart, so its entries stay.)
    '''
    from django.contrib.contenttypes.models import ContentType

    pending = pending_organization_ids(user)
    if not pending:
        return entries
    for model in ORGANIZATION_PATHS:
        gated = model._base_manager.filter(pending_q(model, pending)).values('pk')
        entries = entries.exclude(
            content_type=ContentType.objects.get_for_model(model), object_id__in=gated)
    return entries


def _named_values(request):
    '''The (name, value) pairs of the query string, and of a JSON object body.'''
    for name in NAMED_RECORDS:
        for value in request.query_params.getlist(name):
            yield name, value
    data = request.data if request.method not in ('GET', 'HEAD', 'OPTIONS') else None
    if isinstance(data, dict):
        for name in NAMED_RECORDS:
            if data.get(name) is not None:
                yield name, data[name]


def check_request(request, view):
    '''
    Refuse a request that reaches an organization the user still has to agree
    with, by the ids it names: in its URL, its query string or its body. A
    record the view goes on to fetch is checked as it's fetched (`check_record`).
    '''
    if getattr(view, 'skips_contract_gate', False) or not pending_organization_ids(request.user):
        return
    named = [(model, view.kwargs[kwarg]) for kwarg, model in URL_KWARGS.items()
             if kwarg in view.kwargs]
    named += [(NAMED_RECORDS[name], value) for name, value in _named_values(request)]
    for model, value in named:
        for record in records_named(model, value):
            check_record(request, record)


class ContractGateFilterBackend(BaseFilterBackend):
    '''
    A list leaves out the records of organizations the user still has to agree
    with. (A list that names one by a filter is refused instead: check_request.)
    A view lists them all with `lists_every_organization` (the organization
    chooser).
    '''

    def filter_queryset(self, request, queryset, view):
        if getattr(view, 'action', None) != 'list' or \
                getattr(view, 'lists_every_organization', False) or \
                getattr(view, 'skips_contract_gate', False):
            return queryset
        return exclude_pending(queryset, request.user)


# --- Content ------------------------------------------------------------------------

def content_sha256(body):
    '''The hash of a version's text, which shows it hasn't changed: SHA-256 of its UTF-8.'''
    return hashlib.sha256(body.encode('utf-8')).hexdigest()


def public_terms(organization_id):
    '''
    The organization's latest version, as anyone may read it — the privacy policy
    among its terms is public (DR-145, DR-153): its text, the version and its
    effective date. None when nothing is published.
    '''
    contract = latest_contract(organization_id)
    if contract is None:
        return None
    return {
        'organization': contract.organization_id,
        'organization_name': contract.organization.name,
        'body': contract.body,
        'number': contract.number,
        'published_at': contract.published_at,
    }


# --- Drafting and publishing --------------------------------------------------------

class ContractError(Exception):
    '''The contract can't be changed as asked (409).'''


def start_draft(organization):
    '''
    A new draft: a copy of the latest version's text, or, for the first, empty.
    One draft per organization.
    '''
    with transaction.atomic():
        if models.Contract.objects.filter(
                organization=organization, published_at__isnull=True).exists():
            raise ContractError('This organization already has a draft.')
        latest = latest_contract(organization.pk)
        try:
            with transaction.atomic():
                return models.Contract.objects.create(
                    organization=organization, body=latest.body if latest else '')
        except IntegrityError:
            raise ContractError('This organization already has a draft.')


def publish(contract, user):
    '''
    Publish the draft as the organization's next version; a draft with no text
    is refused. Everyone then needs to agree again; the view publishing it ends
    their sign-ins too (`end_sign_ins`).
    '''
    with transaction.atomic():
        contract = models.Contract.objects.select_for_update().get(pk=contract.pk)
        if contract.is_published:
            raise ContractError('This version is already published.')
        if not contract.body.strip():
            raise ValidationError({'body': 'Write the terms before publishing them.'})
        # Taking the organization keeps two publishes from picking the same number.
        models.Organization.objects.select_for_update().get(pk=contract.organization_id)
        latest = models.Contract.objects.filter(
            organization_id=contract.organization_id).aggregate(Max('number'))['number__max']
        contract.number = (latest or 0) + 1
        contract.content_sha256 = content_sha256(contract.body)
        contract.published_at = timezone.now()
        contract.published_by = user
        contract.save()
        return contract


def end_sign_ins(keep_session_key=None):
    '''
    End everyone's sign-ins, once a version is published (DR-151): every web
    session that signs someone in, except `keep_session_key` (the publisher's,
    who is asked to agree straight away), and every app's OAuth access, the
    publisher's apps included. Each person then meets the new version when they
    next sign in. API tokens for scripts are left; the gate refuses them until
    their user agrees.
    '''
    # Imported here: camphoric.oauth reaches this module through camphoric.permissions.
    from camphoric import oauth

    store = import_module(settings.SESSION_ENGINE).SessionStore
    sessions = store.get_model_class().objects.filter(expire_date__gt=timezone.now())
    for session in sessions.exclude(session_key=keep_session_key or '').iterator():
        if SESSION_KEY in store().decode(session.session_data):
            # By the store, so a cached session goes from the cache too.
            store(session.session_key).delete()
    oauth.revoke_everyone()


# --- Agreeing -----------------------------------------------------------------------

def client_address(request):
    '''
    The client's address as the throttles see it, honouring NUM_PROXIES; None
    when that isn't an IP address.
    '''
    address = BaseThrottle().get_ident(request)
    try:
        return str(ipaddress.ip_address(address))
    except ValueError:
        return None


def agree(request, organization, contract_id, sha256, assent_text):
    '''
    Record that the signed-in user agrees to the organization's latest version,
    which must be the one they were shown (its id and hash). Agreeing again
    does no harm. Returns the agreement.
    '''
    contract = latest_contract(organization.pk)
    if contract is None:
        raise ContractError('This organization has no terms to agree to.')
    if str(contract_id) != str(contract.pk) or sha256 != contract.content_sha256:
        raise ContractError('These terms have changed since you opened them. '
                            'Read the latest version, then agree to it.')
    if not isinstance(assent_text, str) or not assent_text.strip():
        raise ValidationError({'assent_text': 'Say what the person agreed with.'})
    user = request.user
    full_name = ' '.join(part for part in (user.first_name, user.last_name) if part)
    address = client_address(request)
    try:
        with transaction.atomic():
            agreement, _created = models.ContractAgreement.objects.get_or_create(
                user=user, contract=contract,
                defaults={
                    'organization': organization,
                    'agreed_at': timezone.now(),
                    'username': user.get_username(),
                    'email': user.email or '',
                    'full_name': full_name,
                    'ip_address': address,
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'content_sha256': sha256,
                    'assent_text': assent_text.strip()[:200],
                    'app_version': settings.CAMPHORIC_VERSION or '',
                })
    except IntegrityError:
        # The same person agreeing in two tabs at once: the first one counts.
        agreement = models.ContractAgreement.objects.get(user=user, contract=contract)
    forget_pending(user)
    return agreement
