'''
Unsubscribing from an event's group email (SPEC §8.9, DR-48).

Each copy of a group email carries a one-click unsubscribe link: a signed token
naming the event and the address, so the link needs no login and can't be
forged for another address. Following it (or a mail provider's one-click POST)
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


def read_token(token):
    '''(event_id, address) from a token; raises signing.BadSignature if it's not ours.'''
    data = signing.Signer(salt=SALT).unsign_object(token)
    try:
        return int(data['e']), str(data['a'])
    except (KeyError, TypeError, ValueError) as error:
        raise signing.BadSignature('Malformed unsubscribe token') from error


def unsubscribe_url(base, event_id, address):
    '''The one-click unsubscribe link for `address`, or '' without a base.'''
    if not base:
        return ''
    return f'{base}/api/unsubscribe/{make_token(event_id, address)}/'


def unsubscribed(event):
    '''The event's unsubscribed addresses (lowercased).'''
    return set(models.EmailUnsubscribe.objects.filter(event=event)
               .values_list('email', flat=True))


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
