'''
Converting the Mustache confirmation and invitation emails to Jinja
(camphoric.templating.mustache, migration 0065; SPEC DR-45).

The equivalence tests render each template the way Mustache emails were
rendered (the variables below, as Camphoric passed them) and its conversion the
way emails are rendered now, and compare.
'''

import chevron
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase

from camphoric import models
from camphoric.templating import mustache
from camphoric.templating.contexts import confirmation_email_context, invitation_email_context
from camphoric.templating.emails import render_jinja_email
from camphoric.templating.graph import build_event_graph
from camphoric.templating.urls import register_url
from tests.factories import create_template_event

# Everything the old variables offered, the way the event emails used them.
CONFIRMATION = '''Dear {{campers.0.first_name}} {{campers.0.last_name}},
Registration {{registration.id}}, paying by {{registration.payment_type}}.
{{#registration.registration_type}}
Staff type: {{label}}
{{/registration.registration_type}}
{{#registration.attributes.address}}
Address: {{street}}, {{city}}
{{/registration.attributes.address}}
{{#registration.attributes.comments}}Comments: {{.}}{{/registration.attributes.comments}}

{{#campers}}
- {{first_name}} {{last_name}} ({{email}})
  Lodging: {{lodging}} / {{lodging_full}}
  Linens: {{#linens}}Yes{{/linens}}{{^linens}}No{{/linens}}
  Days:{{#attendance}} {{.}}{{/attendance}}
{{#emergency_contact}}
  Contact: {{name}} {{phone}} (for {{first_name}})
{{/emergency_contact}}
  Tuition: ${{pricing_result.tuition}}, total ${{pricing_result.total}}
{{/campers}}

{{#pricing_results.donation}}Donation: ${{pricing_results.donation}}{{/pricing_results.donation}}
{{^pricing_results.parking}}No parking.{{/pricing_results.parking}}
Total: ${{pricing_results.total}}
Paying now: ${{initial_payment.total}} ({{initial_payment.type}})
'''

INVITATION = '''Dear {{recipient_name}} <{{recipient_email}}>,
Code {{invitation_code}}: [register]({{register_link}}) {{{register_link}}}
'''


def legacy_confirmation(registration, template):
    '''The Mustache confirmation email, as it used to be rendered.'''
    pricing_results = registration.server_pricing_results
    campers = [{
        **camper.attributes,
        'pricing_result': pricing_results['campers'][index],
        'lodging': camper.lodging.name if camper.lodging else 'none',
        # The one intended difference: the old path began with the root lodging.
        'lodging_full': (', '.join(n.name for n in camper.lodging.get_parents([])[1:])
                         if camper.lodging else 'none'),
    } for index, camper in enumerate(registration.campers.all())]
    return chevron.render(template, {
        'registration': registration, 'campers': campers,
        'pricing_results': pricing_results, 'initial_payment': registration.initial_payment,
    })


class ConversionTests(TestCase):
    def setUp(self):
        self.made = create_template_event()
        self.event = self.made.event
        self.shapes = mustache.confirmation_shapes(self.event.registration_schema,
                                                   self.event.camper_schema)

    def convert(self, template):
        return mustache.convert(template, self.shapes)

    def test_confirmations_render_the_same(self):
        jinja = self.convert(CONFIRMATION)
        graph = build_event_graph(self.event)
        for registration in (self.made.r1, self.made.r2):
            with self.subTest(registration=registration.id):
                rendered = render_jinja_email(
                    '', jinja, confirmation_email_context(
                        graph, graph.get('registration', registration.id)))
                self.assertEqual(rendered.errors, [])
                # Jinja drops a template's last newline.
                self.assertEqual(rendered.text,
                                 legacy_confirmation(registration, CONFIRMATION).rstrip('\n'))

    def test_invitations_render_the_same(self):
        invitation = self.made.pending
        old = chevron.render(INVITATION, {
            'recipient_name': invitation.recipient_name,
            'recipient_email': invitation.recipient_email,
            'invitation_code': invitation.invitation_code,
            'register_link': register_url(self.event.id, invitation, None),
        })
        graph = build_event_graph(self.event, registration_ids=[])
        new = render_jinja_email('', mustache.convert(INVITATION, mustache.invitation_shapes()),
                                 invitation_email_context(graph, graph.get('invitation',
                                                                           invitation.id)))
        self.assertEqual(new.text, old.rstrip('\n'))

    def test_what_each_construct_becomes(self):
        cases = {
            '{{#campers}}{{first_name}}{{/campers}}':
                '{% for camper in campers %}{{ camper.attributes.first_name }}{% endfor %}',
            '{{campers.0.first_name}}': '{{ campers[0].attributes.first_name }}',
            '{{pricing_results.total}}': '{{ pricing.total }}',
            '{{registration.server_pricing_results.total}}': '{{ registration.pricing.total }}',
            '{{#campers}}{{#attendance}}{{.}}{{/attendance}}{{/campers}}':
                '{% for camper in campers %}{% for attendance_item in '
                '(camper.attributes.attendance or []) %}{{ attendance_item }}'
                '{% endfor %}{% endfor %}',
            '{{#campers}}{{#emergency_contact}}{{name}}{{/emergency_contact}}{{/campers}}':
                '{% for camper in campers %}{% if camper.attributes.emergency_contact %}'
                '{{ (camper.attributes.emergency_contact or {}).name }}{% endif %}{% endfor %}',
            '{{^initial_payment.total}}unpaid{{/initial_payment.total}}':
                '{% if not (initial_payment or {}).total %}unpaid{% endif %}',
            '{{#campers}}{{lodging}}{{/campers}}':
                "{% for camper in campers %}{{ (camper.lodging.name if camper.lodging "
                "else 'none') }}{% endfor %}",
        }
        for template, expected in cases.items():
            with self.subTest(template=template):
                self.assertEqual(self.convert(template), expected)

    def test_jinja_left_alone(self):
        self.assertEqual(self.convert('Plain text, no tags.'), 'Plain text, no tags.')
        self.assertEqual(self.convert(''), '')

    def test_what_cannot_be_converted(self):
        for template in ('{{> header}}', '{{=<% %>=}}', '{{#campers}}open', '{{/campers}}'):
            with self.subTest(template=template), \
                    self.assertRaises(mustache.MustacheConversionError):
                self.convert(template)


class MigrationTests(TransactionTestCase):
    '''Migration 0065 moves both emails into templates, converting Mustache ones.'''
    before = [('camphoric', '0064_email_message_without_event')]
    after = [('camphoric', '0065_email_templates')]

    def tearDown(self):
        MigrationExecutor(connection).migrate(MigrationExecutor(connection).loader.graph
                                              .leaf_nodes())

    def test_emails_become_templates(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.before)
        apps = executor.loader.project_state(self.before).apps
        Organization = apps.get_model('camphoric', 'Organization')
        Event = apps.get_model('camphoric', 'Event')
        RegistrationType = apps.get_model('camphoric', 'RegistrationType')
        organization = Organization.objects.create(name='Org')
        old = Event.objects.create(
            organization=organization, name='Old', confirmation_email_engine='mustache',
            confirmation_email_subject='Thanks, {{campers.0.first_name}}',
            confirmation_email_template='{{#campers}}{{first_name}}{{/campers}}',
            confirmation_email_from='reg@camp.org')
        new = Event.objects.create(
            organization=organization, name='New', confirmation_email_engine='jinja',
            confirmation_email_subject='Hi', confirmation_email_template='{{ event.name }}')
        RegistrationType.objects.create(
            event=old, name='staff', label='Staff', invitation_email_engine='mustache',
            invitation_email_subject='Join', invitation_email_template='{{register_link}}')
        RegistrationType.objects.create(
            event=new, name='crew', label='Crew', invitation_email_engine='mustache',
            invitation_email_subject='Join', invitation_email_template='{{> partial}}')

        executor = MigrationExecutor(connection)
        executor.migrate(self.after)

        old, new = models.Event.objects.get(name='Old'), models.Event.objects.get(name='New')
        self.assertEqual(old.confirmation_template.subject,
                         'Thanks, {{ campers[0].attributes.first_name }}')
        self.assertEqual(old.confirmation_template.body,
                         '{% for camper in campers %}{{ camper.attributes.first_name }}'
                         '{% endfor %}')
        self.assertEqual(old.confirmation_template.purpose, 'confirmation')
        self.assertEqual(old.confirmation_email_from, 'reg@camp.org')
        self.assertEqual((new.confirmation_template.subject, new.confirmation_template.body),
                         ('Hi', '{{ event.name }}'))
        staff = models.RegistrationType.objects.get(name='staff').invitation_template
        self.assertEqual((staff.name, staff.body),
                         ('Invitation: Staff', '{{ invitation.register_url }}'))
        crew = models.RegistrationType.objects.get(name='crew').invitation_template
        self.assertIn("Couldn't be converted from Mustache", crew.body)
        self.assertIn('{{> partial}}', crew.body)
