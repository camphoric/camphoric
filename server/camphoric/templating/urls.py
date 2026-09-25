'''
Links to the public registration page, for templates and emails.

`CAMPHORIC_PUBLIC_URL` (e.g. https://harmonyreg.sffmc.org) makes links work
where there is no request — bulk sends, template checks. Without it, the link
is derived from the current request as it always has been.
'''

import re

from django.conf import settings
from django.urls import reverse


def register_url(event_id, invitation=None, request=None):
    '''The registration page for an event, with an invitation's code if given.'''
    if invitation is not None:
        query = f'?email={invitation.recipient_email}&code={invitation.invitation_code}'
    else:
        query = ''

    base = getattr(settings, 'CAMPHORIC_PUBLIC_URL', '')
    if base:
        return f'{base.rstrip("/")}/events/{event_id}/register{query}'
    if request is None:
        return ''

    path = reverse('register', kwargs={'event_id': event_id})
    url = request.build_absolute_uri(path + query)
    # The API path is served by Django; the page lives at the same path without
    # /api (and on the dev server's port).
    url = re.sub(r':8000', ':3000', url, count=1)
    url = re.sub(r'/api/', '/', url, count=1)
    return url
