'''
Rendering with structured diagnostics and limits (SPEC §9.3, DR-39).

`render_template` never raises for a template's own mistakes. It returns the
output and a list of diagnostics — syntax errors, undefined values, sandbox
refusals, timeouts, an output cap — each with the template line (and, where it
can tell, the column), for the editor to mark. Python tracebacks are logged,
never returned.

Typos are reported as warnings: using a field a Camphoric object doesn't have
(`camper.frist_name`) renders blank, as in plain Jinja, but is flagged.
'''

from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
import logging
import re
import signal
import sys
import threading
import time
import traceback

from jinja2 import Undefined
from jinja2.exceptions import SecurityError, TemplateSyntaxError, UndefinedError

from . import registry
from .env import make_env
from .values import TemplateObject

logger = logging.getLogger(__name__)

MAX_WARNINGS = 50


@dataclass
class Diagnostic:
    severity: str          # 'error' | 'warning'
    kind: str              # syntax | undefined | security | timeout | output_limit | runtime
    message: str
    field: str = 'template'
    line: int | None = None
    column: int | None = None

    def as_dict(self):
        return asdict(self)


@dataclass(frozen=True)
class RenderLimits:
    timeout_s: float
    max_output_chars: int


REPORT_LIMITS = RenderLimits(timeout_s=20, max_output_chars=10_000_000)
PREVIEW_LIMITS = RenderLimits(timeout_s=5, max_output_chars=2_000_000)
EMAIL_LIMITS = RenderLimits(timeout_s=3, max_output_chars=512_000)


@dataclass
class RenderResult:
    output: str
    diagnostics: list = field(default_factory=list)
    truncated: bool = False
    duration_ms: int = 0

    @property
    def ok(self):
        return not any(d.severity == 'error' for d in self.diagnostics)

    @property
    def error(self):
        '''The first error message, for callers that only show one.'''
        return next((d.message for d in self.diagnostics if d.severity == 'error'), None)

    def as_dict(self):
        return {
            'output': self.output,
            'diagnostics': [d.as_dict() for d in self.diagnostics],
            'truncated': self.truncated,
            'duration_ms': self.duration_ms,
        }


# Warnings collected by TrackingUndefined during the current render.
_render_state = threading.local()

FIELDS_BY_TYPE = {
    spec.name: {f.name for f in spec.fields} for spec in registry.TYPES
}


def _template_line():
    '''The template line being rendered, from the Jinja frame on the stack.'''
    frame = sys._getframe(1)
    while frame is not None:
        template = frame.f_globals.get('__jinja_template__')
        if template is not None:
            try:
                return template.get_corresponding_lineno(frame.f_lineno)
            except Exception:  # pragma: no cover - defensive
                return None
        frame = frame.f_back
    return None


class TrackingUndefined(Undefined):
    '''
    Renders blank like Jinja's default, but notes typos on known objects, and
    names Camphoric's types in errors ("registration has no field 'x'" rather
    than a Python class path).
    '''
    __slots__ = ()

    @property
    def _undefined_message(self):
        if self._undefined_hint is None and isinstance(self._undefined_obj, TemplateObject):
            return f"{self._undefined_obj.type_name} has no field '{self._undefined_name}'"
        return super()._undefined_message

    def __init__(self, hint=None, obj=None, name=None, exc=UndefinedError):
        super().__init__(hint=hint, obj=obj, name=name, exc=exc)
        warnings = getattr(_render_state, 'warnings', None)
        if warnings is None or hint is not None or not isinstance(obj, TemplateObject):
            return
        known = FIELDS_BY_TYPE.get(obj.type_name, set())
        if isinstance(name, str) and name not in known and len(warnings) < MAX_WARNINGS:
            line = _template_line()
            key = (line, obj.type_name, name)
            if key not in _render_state.seen:
                _render_state.seen.add(key)
                warnings.append(Diagnostic(
                    severity='warning', kind='undefined', line=line,
                    message=f"{obj.type_name} has no field '{name}'",
                    column=None))


TEXT_ENV = make_env(autoescape=False, undefined=TrackingUndefined)
HTML_ENV = make_env(autoescape=True, undefined=TrackingUndefined)


class RenderTimeout(Exception):
    pass


@contextmanager
def _time_limit(seconds):
    '''
    Stop a render that runs too long. Uses SIGALRM, so it only works in a
    main thread (gunicorn sync workers, management commands); elsewhere (the
    threaded dev server) there is no limit beyond the worker timeout.
    '''
    usable = (seconds and hasattr(signal, 'SIGALRM')
              and threading.current_thread() is threading.main_thread())
    if not usable:
        yield
        return

    def expire(signum, frame):
        raise RenderTimeout()

    previous = signal.signal(signal.SIGALRM, expire)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def _error_line(exc):
    '''The template line in an exception's (Jinja-rewritten) traceback.'''
    line = None
    for frame, lineno in traceback.walk_tb(exc.__traceback__):
        if frame.f_code.co_filename == '<template>':
            line = lineno
    return line


def _column(source, line, exc):
    '''Best-effort column for an undefined/unsafe name on the given line.'''
    if not line:
        return None
    lines = source.splitlines()
    if line > len(lines):
        return None
    text = lines[line - 1]
    # The quoted names in the message, most specific (last) first.
    for quoted in reversed(re.findall(r"'([^']+)'", str(exc))):
        name = quoted.split()[-1]
        for pattern in (f'.{name}', f"['{name}']", name):
            index = text.find(pattern)
            if index >= 0:
                return index + (1 if pattern.startswith('.') else 0) + 1
    return None


def _kind(exc):
    if isinstance(exc, SecurityError):
        return 'security'
    if isinstance(exc, UndefinedError):
        return 'undefined'
    if isinstance(exc, RenderTimeout):
        return 'timeout'
    return 'runtime'


def _message(exc):
    if isinstance(exc, RenderTimeout):
        return 'The template took too long to render.'
    text = str(exc) or type(exc).__name__
    return text if isinstance(exc, (SecurityError, UndefinedError)) \
        else f'{type(exc).__name__}: {text}'


def render_template(source, context, *, fmt='text', limits=REPORT_LIMITS, field='template'):
    '''
    Render `source` with `context`. `fmt` is 'text' (reports, emails) or 'html'
    (autoescaped). Returns a RenderResult; the output of a failed render is
    whatever was produced before the error.
    '''
    started = time.monotonic()
    env = HTML_ENV if fmt == 'html' else TEXT_ENV
    result = RenderResult(output='')

    try:
        template = env.from_string(source or '')
    except TemplateSyntaxError as exc:
        result.diagnostics.append(Diagnostic(
            severity='error', kind='syntax', message=exc.message or str(exc),
            field=field, line=exc.lineno))
        result.duration_ms = int((time.monotonic() - started) * 1000)
        return result

    chunks = []
    size = 0
    _render_state.warnings = []
    _render_state.seen = set()
    try:
        with _time_limit(limits.timeout_s):
            for chunk in template.generate(**context):
                size += len(chunk)
                if size > limits.max_output_chars:
                    chunks.append(chunk[:max(0, len(chunk) - (size - limits.max_output_chars))])
                    result.truncated = True
                    result.diagnostics.append(Diagnostic(
                        severity='error', kind='output_limit', field=field,
                        message=f'The output is longer than {limits.max_output_chars:,} '
                                'characters and was cut off.'))
                    break
                chunks.append(chunk)
    except Exception as exc:  # the template's own error: report it, don't raise
        line = _error_line(exc)
        if not isinstance(exc, (SecurityError, UndefinedError, RenderTimeout)):
            logger.info('template render failed', exc_info=True)
        result.diagnostics.append(Diagnostic(
            severity='error', kind=_kind(exc), message=_message(exc), field=field,
            line=line, column=_column(source, line, exc)))
    finally:
        warnings = _render_state.warnings
        _render_state.warnings = None

    for warning in warnings:
        warning.field = field
        warning.column = _column(source, warning.line, warning.message) \
            if warning.line else None
    result.diagnostics.extend(warnings)
    result.output = ''.join(chunks)
    result.duration_ms = int((time.monotonic() - started) * 1000)
    return result
