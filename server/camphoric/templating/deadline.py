'''
How long a render may run (SPEC §9.3, DR-37, DR-111). The deadline is set for
the render's own context and checked, through Python's `sys.monitoring`, every
time the template's compiled code — or Jinja's and Camphoric's filters, tests
and runtime that it calls — starts a function (a macro call), jumps (a loop
turn) or branches. So it holds in any thread (unlike a signal-based alarm,
which only a main thread gets), recursion and filters included. Outside a
render the checks find no deadline and cost a function call. Only work done
inside one call into Python's own C code (sorting a huge list, say) runs to
its end before the next check.
'''

from contextlib import contextmanager
from contextvars import ContextVar
import sys
import time
import types

import jinja2.filters
import jinja2.runtime
import jinja2.tests

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


def _on_event(code, *args):
    check_deadline()


_EVENTS = _monitoring.events.PY_START | _monitoring.events.JUMP | _monitoring.events.BRANCH

_TOOL_ID = _claim_tool_id()
if _TOOL_ID is not None:
    for event in (_monitoring.events.PY_START, _monitoring.events.JUMP,
                  _monitoring.events.BRANCH):
        _monitoring.register_callback(_TOOL_ID, event, _on_event)


def _code_objects(code):
    yield code
    for constant in code.co_consts:
        if hasattr(constant, 'co_code'):
            yield from _code_objects(constant)


def _watch_code(code):
    for each in _code_objects(code):
        _monitoring.set_local_events(_TOOL_ID, each, _EVENTS)


def _watch_module(module):
    '''Every function and method defined in `module`.'''
    for value in vars(module).values():
        if isinstance(value, types.FunctionType) and value.__module__ == module.__name__:
            _watch_code(value.__code__)
        elif isinstance(value, type) and value.__module__ == module.__name__:
            for member in vars(value).values():
                if isinstance(member, types.FunctionType):
                    _watch_code(member.__code__)


def watch_modules(*modules):
    '''Check the deadline in these modules' code too, whenever a render calls it.'''
    if _TOOL_ID is not None:
        for module in modules:
            _watch_module(module)


watch_modules(jinja2.filters, jinja2.tests, jinja2.runtime)


def watch(template):
    '''Check the deadline as `template` (a compiled Jinja template) runs.'''
    if _TOOL_ID is None:
        return
    for function in (template.root_render_func, *template.blocks.values()):
        _watch_code(function.__code__)


@contextmanager
def time_limit(seconds):
    '''Give what runs inside `seconds` (none: no limit).'''
    token = _deadline.set(time.monotonic() + seconds if seconds else None)
    try:
        yield
    finally:
        _deadline.reset(token)
