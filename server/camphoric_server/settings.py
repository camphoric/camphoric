# Project settings. Everything lives in settings_default.py (environment-driven); this
# module only layers an optional, untracked settings_override.py on top for local or
# host-specific Python overrides.

from camphoric_server.settings_default import *  # noqa: F403 F401

try:
    from camphoric_server.settings_override import *  # noqa: F403 F401
except ImportError:
    pass
