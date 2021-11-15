def get_lodging_schema(event):
    root = event.lodging_set.get(parent=None)
    
    children = root.lodging_set.all()
    is_leaf = len(children) == 0
    if is_leaf:
        return {
            "title": root.name,
            "type": "object",
            "properties": {}
        }
    else:
        enum = [child.id for child in children]
        enum_names = [child.name for child in children]
        return {
            "title": root.name,
            "type": "object",
            "properties": {
                "lodging_1": {
                    "title": root.children_title,
                    "enum": enum,
                    "enumNames": enum_names
                }
            }
        }

