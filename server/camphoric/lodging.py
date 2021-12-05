from collections import defaultdict

from django.db.models import prefetch_related_objects

def get_lodging_schema(event):
    tree = LodgingTree(event).build()
    
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


class LodgingTree:
    def __init__(self, event):
        self.event = event

    def build(self):
        root_lodging = None
        children_lookup = defaultdict(list)

        for lodging in self.event.lodging_set.all():
            if lodging.parent_id:
                children_lookup[lodging.parent_id].append(lodging)
            elif root_lodging:
                raise RuntimeError('Event has multiple root')
            else:
                root_lodging = lodging

        if not root_lodging:
            raise RuntimeError('Event has no root Lodgings')

        self.root = self._build_subtree(root_lodging, children_lookup)

        return self

    def _build_subtree(self, lodging, children_lookup):
        return LodgingTreeNode(
            lodging,
            [
                self._build_subtree(child_lodging, children_lookup)
                for child_lodging in children_lookup[lodging.id]
            ]
        )


class LodgingTreeNode:
    def __init__(self, lodging, children):
        self.lodging = lodging
        self.children = children

    @property
    def visible_children(self):
        # TODO: filter out nodes with no remaining capacity or which are not visible
        return self.children
