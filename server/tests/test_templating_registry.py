'''
Keep the description of template variables (registry.py) in step with what
templates actually receive — it's what the editor's autocomplete and the help
pages show authors.
'''

from django.test import TestCase

from camphoric.templating import contexts, registry
from camphoric.templating.graph import build_event_graph
from camphoric.templating.render import HTML_ENV, TEXT_ENV
from camphoric.templating.values import TemplateObject

from tests.factories import create_template_event


def objects_in(value, seen=None):
    '''Every Camphoric object reachable from a value.'''
    seen = {} if seen is None else seen
    if isinstance(value, TemplateObject):
        key = (value.type_name, id(value))
        if key in seen:
            return seen
        seen[key] = value
        for item in value.values():
            objects_in(item, seen)
    elif isinstance(value, dict):
        for item in value.values():
            objects_in(item, seen)
    elif isinstance(value, (list, tuple)):
        for item in value:
            objects_in(item, seen)
    return seen


class RegistryDriftTests(TestCase):
    def setUp(self):
        self.made = create_template_event()
        self.graph = build_event_graph(self.made.event)

    def test_every_graph_object_has_exactly_its_described_fields(self):
        found = objects_in(contexts.report_context(self.graph))
        found.update(objects_in(contexts.recipient('a@example.com', 'A')))
        types_seen = set()
        for (type_name, _), obj in found.items():
            spec = registry.TYPES_BY_NAME[type_name]
            self.assertIs(type(obj), spec.var_class)
            self.assertEqual(set(obj), {f.name for f in spec.fields}, type_name)
            types_seen.add(type_name)
        described = {spec.name for spec in registry.TYPES if spec.var_class is not None}
        self.assertEqual(types_seen, described)

    def test_every_context_has_exactly_its_described_roots(self):
        registration = self.graph.registrations[0]
        camper = self.graph.campers[0]
        invitation = self.graph.invitations[0]
        to = contexts.recipient('a@example.com')
        built = {
            'report': contexts.report_context(self.graph),
            'confirmation_email': contexts.confirmation_email_context(self.graph, registration),
            'confirmation_page': contexts.confirmation_page_context(self.graph, registration),
            'invitation_email': contexts.invitation_email_context(self.graph, invitation),
            'bulk_email_registration': contexts.bulk_email_registration_context(
                self.graph, registration, to),
            'bulk_email_camper': contexts.bulk_email_camper_context(self.graph, camper, to),
            'bulk_email_manual': contexts.bulk_email_manual_context(self.graph, to),
        }
        self.assertEqual(set(built), set(registry.CONTEXTS_BY_NAME))
        for name, context in built.items():
            roots = {f.name for f in registry.CONTEXTS_BY_NAME[name].roots}
            self.assertEqual(set(context), roots, name)

    def test_every_filter_is_described(self):
        for env in (TEXT_ENV, HTML_ENV):
            undocumented = set(env.filters) - set(registry.FILTERS_BY_NAME) \
                - registry.HIDDEN_FILTERS
            self.assertEqual(undocumented, set())
        missing = set(registry.FILTERS_BY_NAME) - set(TEXT_ENV.filters)
        self.assertEqual(missing, set())

    def test_every_described_test_exists(self):
        missing = {t.name for t in registry.TESTS} - set(TEXT_ENV.tests)
        self.assertEqual(missing, set())

    def test_field_types_refer_to_known_types(self):
        scalars = {'string', 'number', 'bool', 'money', 'date', 'datetime', 'dict', 'any'}
        dynamic_prefixes = ('attributes:', 'admin_attributes:', 'pricing:')
        names = set(registry.TYPES_BY_NAME)
        fields = [f for spec in registry.TYPES for f in spec.fields] \
            + [f for spec in registry.CONTEXTS for f in spec.roots]
        for f in fields:
            type_name = f.type[5:-1] if f.type.startswith('list<') else f.type
            self.assertTrue(type_name in scalars or type_name in names
                            or type_name.startswith(dynamic_prefixes), f'{f.name}: {f.type}')
