'''
How long a render may run (SPEC §9.3, DR-37, DR-111). The deadline is set for
the render's own context and checked every time the template's compiled code
jumps — each turn of every loop, each branch — through Python's
`sys.monitoring`, watching only that template's code. So it holds in any
thread (unlike a signal-based alarm, which only a main thread gets) and costs
nothing outside templates. A single filter or function call the template makes
runs to its end before the next check.
'''

from contextlib import contextmanager
from contextvars import ContextVar
import sys
import time

_deadline = ContextVar('camphoric_render_deadline', default=None)

_monitoring = sys.monitoring


def _claim_tool_id():
    '''A sys.monitoring tool id nobody else (a debugger, coverage) is using.'''
    for tool_id in (_monitoring.OPTIMIZER_ID, 4, 3):
        if _monitoring.get_tool(tool_id) is None:
            _monitoring.use_tool_id(tool_id, 'camphoric render deadline')
            return tool_id
    return None


class RenderTimeout(Exception):
    pass


def check_deadline():
    '''Raise RenderTimeout once the current render's time is up.'''
    deadline = _deadline.get()
    if deadline is not None and time.monotonic() > deadline:
        raise RenderTimeout()


def _on_jump(code, instruction_offset, destination_offset):
    check_deadline()


_TOOL_ID = _claim_tool_id()
if _TOOL_ID is not None:
    _monitoring.register_callback(_TOOL_ID, _monitoring.events.JUMP, _on_jump)


def _code_objects(code):
    yield code
    for constant in code.co_consts:
        if hasattr(constant, 'co_code'):
            yield from _code_objects(constant)


def watch(template):
    '''Check the deadline as `template` (a compiled Jinja template) runs.'''
    if _TOOL_ID is None:
        return
    functions = [template.root_render_func, *template.blocks.values()]
    for function in functions:
        for code in _code_objects(function.__code__):
            _monitoring.set_local_events(_TOOL_ID, code, _monitoring.events.JUMP)


@contextmanager
def time_limit(seconds):
    '''Give what runs inside `seconds` (none: no limit).'''
    token = _deadline.set(time.monotonic() + seconds if seconds else None)
    try:
        yield
    finally:
        _deadline.reset(token)
