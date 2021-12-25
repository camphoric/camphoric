from collections import defaultdict

from django.db.models import Count, Q


def get_lodging_schema(event, show_all=False):
    tree = LodgingTree(event, show_all).build()

    return (
        get_lodging_json_schema(tree),
        get_lodging_ui_schema(tree)
    )


def get_lodging_json_schema(tree):
    def make_enum(node):
        children = node.visible_children

        if len(children) == 0:
            return {}

        return {
            'title': node.lodging.children_title,
            'enum': [child.lodging.id for child in children],
            'enumNames': [child.lodging.name for child in children],
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

    if len(children) == 0:
        return {
            'type': 'object',
            'title': root.lodging.name,
            'properties': {},
            'dependencies': {},
        }

    return {
        'type': 'object',
        'title': root.lodging.name,
        'properties': {
            'lodging_1': make_enum(root),
        },
        'required': ['lodging_1'],
        'dependencies': make_dependencies(root, 1),
    }


def get_lodging_ui_schema(tree):
    if tree.root is None:
        return None

    ui_schema = {}

    def set_enum_disabled(node, depth):
        unreserved_capacity = node.capacity - node.reserved
        unreserved_campers = node.camper_count - node.camper_reserved_count

        if unreserved_campers >= unreserved_capacity:
            key = f'lodging_{depth}'
            if key not in ui_schema:
                ui_schema[key] = {'ui:enumDisabled': []}
            ui_schema[key]['ui:enumDisabled'].append(node.lodging.id)

        for child in node.children:
            set_enum_disabled(child, depth + 1)

    set_enum_disabled(tree.root, 0)

    return ui_schema


class LodgingTree:
    def __init__(self, event, show_all=False):
        self.event = event
        self.show_all = show_all
        self.root = None

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

        return LodgingTreeNode(
            lodging,
            children,
            show_all=self.show_all
        )

    def get(self, lodging_id):
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

        if len(children):
            self.capacity = sum(child.capacity for child in children)
            self.reserved = sum(child.reserved for child in children)
        else:
            self.capacity = lodging.capacity
            self.reserved = lodging.reserved

        self.camper_count = lodging.camper_count + sum(
            child.camper_count for child in children)
        self.camper_reserved_count = lodging.camper_reserved_count + sum(
            child.camper_reserved_count for child in children)

    @property
    def visible_children(self):
        return [c for c in self.children if c.visible]

    @property
    def visible(self):
        return self.show_all or self.lodging.visible
