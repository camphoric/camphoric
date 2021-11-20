def get_lodging_schema(event):
    root = event.lodging_set.get(parent=None)
    
    def make_enum(lodging):
        children = list(lodging.lodging_set.all())

        if len(children) == 0:
            return {}

        return {
            'title': lodging.children_title,
            'enum': [child.id for child in children],
            'enumNames': [child.name for child in children],
        }

    def make_dependencies(lodging, depth):
        children = list(lodging.lodging_set.all())

        if len(children) == 0:
            return {}

        dependency_list = [
            {
                'properties': {
                    f'lodging_{depth}': {
                        'enum': [child.id],
                    },
                    f'lodging_{depth + 1}': make_enum(child),
                },
                'required': [
                    f'lodging_{depth + 1}'
                ],
                'dependencies': make_dependencies(child, depth + 1),
            }
            for child in children if len(child.lodging_set.all()) > 0
        ]

        if len(dependency_list) == 0:
            return {}

        return {
            f'lodging_{depth}': {
                'oneOf': dependency_list,
            },
        }

    root = event.lodging_set.get(parent=None)
    children = list(root.lodging_set.all())

    if len(children) == 0:
        return {
            'type': 'object',
            'title': root.name,
            'properties': {},
            'dependencies': {},
        }
        
    return {
        'type': 'object',
        'title': root.name,
        'properties': {
            'lodging_1': make_enum(root),
        },
        'required': ['lodging_1'],
        'dependencies': make_dependencies(root, 1),
    }
