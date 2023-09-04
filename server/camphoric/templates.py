'''
Template-related functions
'''

import logging
import traceback
import re
from jinja2 import BaseLoader
from jinja2.sandbox import SandboxedEnvironment
from camphoric import (
    models,
    serializers,
)

logger = logging.getLogger(__name__)

jinja_env = SandboxedEnvironment(
    extensions=['jinja2.ext.do', 'jinja2.ext.loopcontrols'],
    loader=BaseLoader(),
)


# Custom filter method
def regex_replace(s, find, replace):
    """A non-optimal implementation of a regex filter"""
    return re.sub(find, replace, s)


jinja_env.filters['regex_replace'] = regex_replace


def get_template_vars(event_id):
    '''
    This returns variables used by almost all jinja templates.  See the
    `get_*_specific_template_vars` for additions in specific situations
    '''
    event = models.Event.objects.get(id=event_id)
    registrations = models.Registration.objects.filter(event_id=event.id)
    registrations_lookup = {x.id: x for x in registrations}
    campers = models.Camper.objects.filter(registration__event_id=event.id)
    campers_lookup = {x.id: x for x in campers}
    lodgings = models.Lodging.objects.filter(event_id=event.id)
    lodgings_lookup = {x.id: x for x in lodgings}

    return {
        'event': event,
        'registrations': registrations,
        'registrations_lookup': registrations_lookup,
        'campers': campers,
        'campers_lookup': campers_lookup,
        'lodgings_lookup': lodgings_lookup,
    }


def get_camper_specific_template_vars(camper_id):
    '''
    This returns variables used by almost all jinja templates.  See the
    `get_*_specific_template_vars` for additions in specific situations
    '''
    camper = models.Camper.objects.get(id=camper_id).values()
    registration_vars = get_registration_specific_template_vars(camper['registration_id'])

    return {
        'camper': camper,
        **registration_vars,
    }


def get_registration_specific_template_vars(registration_id):
    '''
    This returns variables used by almost all jinja templates.  See the
    `get_*_specific_template_vars` for additions in specific situations
    '''
    registration = models.Registration.objects.get(id=registration_id).values()
    template_vars = get_template_vars(registration['id'])

    return {
        'registration': registration,
        **template_vars,
    }


def render_jinja_template(tpl, data):
    '''
    Instantiate the email backend for the given event (camphoric.models.Event)
    to be passed as the `connection` argument of EmailMessage,
    EmailMultiAlternatives, etc.
    '''

    output = ''
    error = None
    try:
        output = jinja_env \
                .from_string(tpl) \
                .render(**data)
    except Exception as e:
        tb = traceback.format_exc() or ''
        start = tb.find('File "<template>"')
        if start < 0:
            start = tb.find('File "<unknown>"')
        emessage = tb[start:]

        error = str(e) + "\n" + emessage + str(start)
        output = ''

    return {
        'report': output,
        'error': error
    }
