'''
Unsubscribing from an event's group email (SPEC §8.9, DR-48).

Each copy of a group email carries a one-click unsubscribe link: a signed token
naming the event and the address, so the link needs no login and can't be
forged for another address. Following it opens the client's page, which asks to
confirm (DR-154); confirming, or a mail provider's one-click POST to the link,
records the address as unsubscribed; group email then skips it. Confirmations
and invitations aren't affected.
'''

from email.utils import parseaddr
import logging

from django.core import signing
from django.db import IntegrityError, transaction
from django.utils.html import escape

from camphoric import models

logger = logging.getLogger(__name__)

SALT = 'camphoric.email.unsubscribe'


def normalize(address):
    '''The bare, lowercased address of `Name <address>` or `address`.'''
    return parseaddr(address or '')[1].strip().lower()


def make_token(event_id, address):
    return signing.Signer(salt=SALT).sign_object(
        {'e': event_id, 'a': normalize(address)}, compress=True)


def make_organization_token(organization_id, address):
    '''A token for an organization's email to past campers (SPEC §8.12, DR-182).'''
    return signing.Signer(salt=SALT).sign_object(
        {'o': organization_id, 'a': normalize(address)}, compress=True)


def read_token(token):
    '''(event_id, address) from a token; raises signing.BadSignature if it's not ours.'''
    scope, target_id, address = read_any_token(token)
    if scope != 'event':
        raise signing.BadSignature('Not an event unsubscribe token')
    return target_id, address


def read_any_token(token):
    '''
    `('event', event_id, address)` or `('organization', organization_id,
    address)` from a token; raises signing.BadSignature if it's not ours.
    '''
    data = signing.Signer(salt=SALT).unsign_object(token)
    try:
        if 'o' in data:
            return 'organization', int(data['o']), str(data['a'])
        return 'event', int(data['e']), str(data['a'])
    except (KeyError, TypeError, ValueError) as error:
        raise signing.BadSignature('Malformed unsubscribe token') from error


def unsubscribe_url(base, event_id, address):
    '''The one-click unsubscribe link for `address`, or '' without a base.'''
    if not base:
        return ''
    return f'{base}/api/unsubscribe/{make_token(event_id, address)}/'


def organization_unsubscribe_url(base, organization_id, address):
    '''The one-click link out of an organization's email to past campers, or '' without a base.'''
    if not base:
        return ''
    return f'{base}/api/unsubscribe/{make_organization_token(organization_id, address)}/'


def unsubscribe_organization(organization, address, *, source, created_by=None):
    '''Record `address` as unsubscribed from the organization's email to past campers.'''
    email = normalize(address)
    try:
        with transaction.atomic():
            row, created = models.OrganizationUnsubscribe.objects.get_or_create(
                organization=organization, email=email,
                defaults={'source': source, 'created_by': created_by})
    except IntegrityError:
        row, created = models.OrganizationUnsubscribe.objects.get(
            organization=organization, email=email), False
    if created:
        logger.info(f'{email} unsubscribed from email to past campers of organization '
                    f'{organization.id} ({source})')
    return row


def organization_footer(organization_name, url):
    '''The footer of an organization's email to past campers: why they got it, and the link.'''
    text = (f'\n\n--\nYou received this email because you came to an event of '
            f'{organization_name}. To stop getting these emails, unsubscribe: {url}\n')
    html = ('<hr style="border:none;border-top:1px solid #ddd;margin-top:24px">'
            '<p style="font-size:12px;color:#666">'
            f'You received this email because you came to an event of '
            f'{escape(organization_name)}. <a href="{escape(url)}">Unsubscribe</a> '
            'from these emails.</p>')
    return text, html


def unsubscribe(event, address, *, source, created_by=None):
    '''Record `address` as unsubscribed from the event's group email. Returns the row.'''
    email = normalize(address)
    try:
        with transaction.atomic():
            row, created = models.EmailUnsubscribe.objects.get_or_create(
                event=event, email=email,
                defaults={'source': source, 'created_by': created_by})
    except IntegrityError:
        row, created = models.EmailUnsubscribe.objects.get(event=event, email=email), False
    if created:
        logger.info(f'{email} unsubscribed from group email for event {event.id} ({source})')
    return row


def footer(event_name, url):
    '''The text and HTML appended to a group email's copy: why they got it, and the link.'''
    text = (f'\n\n--\nYou received this email about {event_name}. '
            f'To stop getting these emails, unsubscribe: {url}\n')
    html = ('<hr style="border:none;border-top:1px solid #ddd;margin-top:24px">'
            '<p style="font-size:12px;color:#666">'
            f'You received this email about {escape(event_name)}. '
            f'<a href="{escape(url)}">Unsubscribe</a> from these emails.</p>')
    return text, html
