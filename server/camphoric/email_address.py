'''
The email-address rule the registration form applies (SPEC §7.1, DR-166).

An address is valid when both Django's `validate_email` (what the outbox
checks before it sends) and ajv's `email` format (what the form checks in
the browser) accept it. The client's check, `isEmailAddress` in
client/src/components/form/emailAddress.ts, is the same rule from the other
side, so the two agree.

Django's check accepts some forms ajv's refuses, which are left out here:
a non-ASCII character anywhere (Django's case-insensitive match lets some
through, like `ſ`), a quoted local part (`"jane"@example.com`), and a domain
that isn't a host name (`localhost`, an `[IP]` literal).
'''

import jsonschema
from django.core.exceptions import ValidationError
from django.core.validators import validate_email


def is_email_address(value):
    '''Whether the string `value` is an email address under the form's rule.'''
    if not value.isascii():
        return False
    try:
        validate_email(value)
    except ValidationError:
        return False
    local, domain = value.rsplit('@', 1)
    return (not local.startswith('"')
            and validate_email.domain_regex.match(domain) is not None)


def check_email(instance):
    '''The `email` format: a string must be an address; other types pass.'''
    return not isinstance(instance, str) or is_email_address(instance)


# Draft 7's format checks, with `email` checked by the rule above: the
# default email check only looks for an `@`.
FORMAT_CHECKER = jsonschema.FormatChecker(formats=())
FORMAT_CHECKER.checkers = {
    **jsonschema.Draft7Validator.FORMAT_CHECKER.checkers,
    'email': (check_email, ()),
}
