'''
Sandboxed Jinja environments (SPEC §9.3, DR-39).

`TEXT_ENV` / `HTML_ENV` render the new Camphoric-variables templates: the
Jinja sandbox (no `_private` attributes, no `__class__` tricks, capped
`range`) plus a read-only policy for Camphoric's objects. `LEGACY_REPORT_ENV`
renders the older reports whose variables the client posts; it is sandboxed
too, but lets templates change those posted dicts, as they always have.
'''

from jinja2 import BaseLoader
from jinja2.exceptions import SecurityError
from jinja2.sandbox import SandboxedEnvironment

from camphoric.pricing import money_fmt as legacy_money_fmt

from .filters import FILTERS, regex_replace
from .values import MUTATING_METHODS, ReadOnly

EXTENSIONS = ['jinja2.ext.do', 'jinja2.ext.loopcontrols']

READ_ONLY_HINT = (
    "Camphoric's objects are read-only, so '{attribute}' can't be used on them. "
    'Build your own list or dict instead — see Template Help › Computed values.'
)


class CamphoricSandbox(SandboxedEnvironment):
    def is_safe_attribute(self, obj, attr, value):
        if isinstance(obj, ReadOnly) and attr in MUTATING_METHODS:
            return False
        return super().is_safe_attribute(obj, attr, value)

    def unsafe_undefined(self, obj, attribute):
        if isinstance(obj, ReadOnly) and attribute in MUTATING_METHODS:
            return self.undefined(
                READ_ONLY_HINT.format(attribute=attribute),
                name=attribute, obj=obj, exc=SecurityError)
        return super().unsafe_undefined(obj, attribute)


def _finalize(value):
    return '' if value is None else value


def make_env(*, autoescape, undefined=None):
    options = {'undefined': undefined} if undefined is not None else {}
    env = CamphoricSandbox(
        extensions=EXTENSIONS,
        loader=BaseLoader(),
        autoescape=autoescape,
        finalize=_finalize,
        **options,
    )
    env.filters.update(FILTERS)
    env.globals.pop('lipsum', None)
    return env


def _make_legacy_env():
    env = SandboxedEnvironment(extensions=EXTENSIONS, loader=BaseLoader())
    env.filters['regex_replace'] = regex_replace
    env.filters['money_fmt'] = legacy_money_fmt
    return env


LEGACY_REPORT_ENV = _make_legacy_env()
