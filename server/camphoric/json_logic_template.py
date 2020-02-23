"""
JsonLogic-based templates 

Provides a way of safely rendering text from user-supplied templates (e.g.
event-specific confirmation emails).

One of these templates is just a list where each element is either:
- just a string, or
- a JsonLogic dict, which will be evaluated with the given `data`

Each piece of JsonLogic may return a list, which will itself be rendered as a
template.
"""

# TODO: Add validate function

from json_logic import jsonLogic


def render(template, data):
    return ''.join([_render_chunk(chunk, data) for chunk in template])


def _render_chunk(chunk, data):
    if isinstance(chunk, dict):
        chunk = jsonLogic(chunk, data)
    if isinstance(chunk, list):
        chunk = render(chunk, data)
    return str(chunk)
