'''
The lodging for an event is arranged in a tree, e.g.

    root
     |
     |--------------.
     |              |
    camp 1         camp 2
     |              |
     |-------.      |-------.
     |       |      |       |
    cabins  tents  cabins  tents
     | | |          | | |
     1 2 3          4 5 6

Each leaf node represents a possible lodging assignment for a camper. Campers
select a lodging option during registration. The available options may exclude
the most specific assignments (e.g. cabin numbers in the tree above), which must
be set later by an admin.


Overbooking
-----------

If a lodging node is full, it will be disabled in the UI schema (and therefore
disabled on the registration form). However, an admin can overbook a lodging
node without affecting ancestor nodes. For example, in the tree above, if the
camp 1 cabins are completely full, overbooking a cabin will not affect the
remaining capacity of camp 1, and so will not disable camp 1 as an option on the
registration form.


See also:
- camphoric.models.Lodging
- camphoric.models.Camper
'''

from collections import defaultdict

from django.db.models import Count, Sum, Q
from django.forms.models import model_to_dict

# These properties are imported and used by tests, so should be considered
# canonical across all code.

LODGING_COMMENTS_PROPERTY = {
    'type': 'string',
    'maxLength': 300,
    'title': 'Is there anything else we should know about your lodging preferences?'
}


LODGING_COMMENTS_UI = {
    'ui:widget': 'textarea',
    'ui:options': {'rows': 3, 'maxlength': 300},
}


LODGING_SHARED_PROPERTY = {
    'type': 'boolean',
    'title': 'I will be sharing this space with one or more other people',
}


LODGING_SHARED_DEPENDENCY = {
    'oneOf': [
        {
            'properties': {
                'lodging_shared': {'enum': [False]},
            },
        },
        {
            'properties': {
                'lodging_shared': {'enum': [True]},
                'lodging_shared_with': {
                    'type': 'string',
                    'title': 'Who will you be sharing this space with?',
                },
            },
            'required': ['lodging_shared_with'],
        },
    ],
}


LODGING_SCHEMA = {
    'properties': {
        'lodging_shared': LODGING_SHARED_PROPERTY,
        'lodging_comments': LODGING_COMMENTS_PROPERTY,
        'lodging_requested': {
            'type': 'object',
            'title': 'Lodging',
            'required': ['id', 'choices'],
            'properties': {
                'id': {'type': 'number'},
                'name': {'type': 'string'},
                'choices': {
                    'type': 'array',
                    'minItems': 1,
                    'items': {
                        'type': 'number',
                    },
                },
            },
        },
    },
    'dependencies': {
        'lodging_shared': LODGING_SHARED_DEPENDENCY,
    },
    'ui:order': [
        'lodging_requested',
        'lodging_shared',
        'lodging_shared_with',
        'lodging_comments',
    ],
    'ui': {
        'lodging_comments': LODGING_COMMENTS_UI,
    },
}


def get_lodging_schema(event, show_all=False):
    '''
    Return a tuple with the JSON schema and UI schema for the lodging for the
    given event (camphoric.models.Event), to be rendered by
    react-jsonschema-form on the registration page.

    The JSON schema is designed to render as a series of <select> menus, where
    each selection causes the next menu to appear, allowing the user to navigate
    down the tree. An object matching the schema (i.e. generated by the form)
    looks something like

        {
            'lodging': {
              'lodging_requested': {
                'choices': [ 55, 56, 57 ],
                'id': 57, # Final choice
                'name': 'My Cabin',
              },
              # Other properties
            },
        }
    '''
    tree = LodgingTree(event, show_all).build()

    if tree.root is None:
        return (None, None)

    return (
        get_simple_lodging_json_schema(tree),
        get_lodging_ui_schema(tree)
    )


def get_simple_lodging_json_schema(tree):
    return {
        'type': 'object',
        'title': 'Lodging',
        'properties': {
            **LODGING_SCHEMA['properties'],
        },
        'dependencies': LODGING_SCHEMA['dependencies'],
    }


def get_lodging_json_schema(tree):
    def make_enum(node):
        children = node.visible_children

        if len(children) == 0:
            return {}

        return {
            'title': node.lodging.children_title,
            'enum': [child.lodging.id for child in children],
            'enumNames': [
                child.lodging.name
                if child.remaining_unreserved_capacity > 0
                else f'{child.lodging.name} (full)'
                for child in children
            ],
        }

    def make_dependencies(node, depth):
        children = node.visible_children

        if len(children) == 0:
            return {}

        dependency_list = [
            {
                'properties': {
                    f'lodging_{depth}': {
                        'enum': [child.lodging.id],
                    },
                    f'lodging_{depth + 1}': make_enum(child),
                },
                'required': [
                    f'lodging_{depth + 1}'
                ],
                'dependencies': make_dependencies(child, depth + 1),
            }
            for child in children if len(child.visible_children) > 0
        ]

        if len(dependency_list) == 0:
            return {}

        return {
            f'lodging_{depth}': {
                'oneOf': dependency_list,
            },
        }

    root = tree.root
    if root is None:
        return None

    children = root.visible_children

    schema = {
        'type': 'object',
        'title': root.lodging.name,
        'properties': LODGING_SCHEMA['properties'],
        'dependencies': LODGING_SCHEMA['dependencies'],
    }

    if len(children) > 0:
        schema['properties']['lodging_1'] = make_enum(root)
        schema['required'] = ['lodging_1']
        schema['dependencies'].update(make_dependencies(root, 1))

    return schema


def get_lodging_ui_schema(tree):
    if tree.root is None:
        return None

    ui_schema = {}
    max_depth = 0

    def traverse(node, depth):
        nonlocal max_depth
        max_depth = max(max_depth, depth)

        if node.remaining_unreserved_capacity <= 0:
            key = f'lodging_{depth}'
            if key not in ui_schema:
                ui_schema[key] = {'ui:enumDisabled': []}
            ui_schema[key]['ui:enumDisabled'].append(node.lodging.id)

        for child in node.children:
            traverse(child, depth + 1)

    traverse(tree.root, 0)

    ui_schema['ui:order'] = [
        # *(f'lodging_{depth}' for depth in range(1, max_depth + 1)),
        *LODGING_SCHEMA['ui:order'],
    ]

    ui_schema['lodging_comments'] = LODGING_COMMENTS_UI
    ui_schema['lodging_requested'] = {
        'ui:field': 'LodgingRequested',
        'lodging_nodes': tree.registration_nodes,
    }

    return ui_schema


class LodgingTree:
    def __init__(self, event, show_all=False):
        self.event = event
        self.show_all = show_all
        self.root = None
        self.registration_nodes = []

    def build(self):
        root_lodging = None
        children_lookup = defaultdict(list)

        camper_event_filter = Q(camper__registration__event__id=self.event.id)
        camper_reserved_filter = Q(camper__lodging_reserved=True)

        annotated_lodgings = self.event.lodging_set.annotate(
            camper_count=Count(
                'camper',
                filter=camper_event_filter),
            camper_reserved_count=Count(
                'camper',
                filter=(camper_event_filter & camper_reserved_filter)),
            camper_count_adjusted=Sum(
                'camper__lodging__sharing_multiplier',
                filter=camper_event_filter),
            camper_reserved_count_adjusted=Sum(
                'camper__lodging__sharing_multiplier',
                filter=(camper_event_filter & camper_reserved_filter)),
        ).order_by('id')

        for lodging in annotated_lodgings:
            if lodging.parent_id:
                children_lookup[lodging.parent_id].append(lodging)
            elif root_lodging:
                raise RuntimeError('Event has multiple root')
            else:
                root_lodging = lodging

        if root_lodging:
            self.root = self._build_subtree(root_lodging, children_lookup)

        return self

    def _build_subtree(self, lodging, children_lookup):
        children = [
            self._build_subtree(child_lodging, children_lookup)
            for child_lodging in children_lookup[lodging.id]
        ]

        new_node = LodgingTreeNode(
            lodging,
            children,
            show_all=self.show_all
        )

        if new_node.visible:
            self.registration_nodes.append(
                new_node.to_registration_data()
            )

        return new_node

    def get(self, lodging_id):
        return self._get(lodging_id, self.root)

    def get_node(self, lodging_id):
        return self._get(lodging_id, self.root)

    def _get(self, lodging_id, current):
        if current.lodging.id == lodging_id:
            return current

        for child in current.children:
            node = self._get(lodging_id, child)
            if node:
                return node

        return None


class LodgingTreeNode:
    def __init__(self, lodging, children, show_all=False):
        self.lodging = lodging
        self.children = children
        self.show_all = show_all

        self.camper_count = lodging.camper_count + sum(
            child.camper_count for child in children)
        self.camper_reserved_count = lodging.camper_reserved_count + sum(
            child.camper_reserved_count for child in children)

        self.camper_count_adjusted = (lodging.camper_count_adjusted or 0) + sum(
            child.camper_count_adjusted for child in children)
        self.camper_reserved_count_adjusted = (lodging.camper_reserved_count_adjusted or 0) + sum(
            child.camper_reserved_count_adjusted for child in children)

        if len(children):
            self.capacity = sum(child.capacity for child in children)
            self.reserved = sum(child.reserved for child in children)
            self.remaining_unreserved_capacity = max(
                0,
                sum(child.remaining_unreserved_capacity for child in children)
                - ((lodging.camper_count_adjusted or 0) -
                   (lodging.camper_reserved_count_adjusted or 0)))
        else:
            self.capacity = lodging.capacity
            self.reserved = lodging.reserved
            self.remaining_unreserved_capacity = max(0, (
                (self.capacity - self.reserved)
                - (self.camper_count_adjusted - self.camper_reserved_count_adjusted)))

    def to_registration_data(self):
        return {
            **model_to_dict(self.lodging),
            'capacity': self.capacity,
            'camper_count_adjusted': self.camper_count_adjusted,
            'remaining_unreserved_capacity': self.remaining_unreserved_capacity,
        }

    @property
    def visible_children(self):
        return [c for c in self.children if c.visible]

    @property
    def visible(self):
        return self.show_all or self.lodging.visible
