import jsonschema
from django.test import SimpleTestCase

from camphoric.email_address import FORMAT_CHECKER, is_email_address

# The same cases as client/src/components/form/test/emailAddress.test.ts and
# data/packages/event-import-spec/__tests__/formSchema.test.ts: all three apply
# one rule (SPEC DR-166), so keep them in step.
VALID = [
    'jane-doe@my-camp.org',
    'jane+camp@example.com',
    "o'brien@example.com",
    'jane@example.photography',
    'jane@example.museum',
    'a=b@example.com',
    "!#$%&'*+/=?^_`{|}~-@example.com",
    'jane.doe@example.co.uk',
    'JANE@EXAMPLE.COM',
    'jane@123.example.com',
    'jane@xn--exmple-cua.com',
    'jane@example.xn--p1ai',
    'jane@' + 'a' * 63 + '.com',
]

INVALID = [
    '',
    'jane',
    'jane@',
    '@example.com',
    'jane doe@example.com',
    'jane@exa mple.com',
    ' jane@example.com',
    'jane@example.com ',
    'jane@example.com\n',
    'jane@@example.com',
    'jane..doe@example.com',
    '.jane@example.com',
    'jane.@example.com',
    'jane@example..com',
    'jane@.example.com',
    'jane@example.com.',
    'jane@-example.com',
    'jane@example-.com',
    'jane@example_x.com',
    # Django refuses these; ajv alone would take them.
    'jane@gmail.c',
    'jane@example.123',
    'jane@' + 'a' * 64 + '.com',
    'jane@example.' + 'a' * 64,
    'j' * 310 + '@example.com',
    # ajv refuses these; Django alone would take them.
    'jane@localhost',
    'jane@[127.0.0.1]',
    '"jane"@example.com',
    'jane@exämple.com',
    'jöhn@example.com',
    'jaſe@example.com',  # ſ, which Django's case-insensitive match lets in
]


class IsEmailAddressTests(SimpleTestCase):
    def test_valid(self):
        for email in VALID:
            with self.subTest(email=email):
                self.assertTrue(is_email_address(email))

    def test_invalid(self):
        for email in INVALID:
            with self.subTest(email=email):
                self.assertFalse(is_email_address(email))


class FormatCheckerTests(SimpleTestCase):
    def validator(self, schema):
        return jsonschema.Draft7Validator(schema, format_checker=FORMAT_CHECKER)

    def test_checks_email(self):
        validator = self.validator({'type': 'string', 'format': 'email'})
        self.assertTrue(validator.is_valid("o'brien@example.com"))
        self.assertFalse(validator.is_valid('jane@gmail.c'))

    def test_email_ignores_other_types(self):
        # `type` refuses those; the format only applies to strings.
        self.assertTrue(self.validator({'format': 'email'}).is_valid(42))

    def test_keeps_draft7s_other_formats(self):
        validator = self.validator({'type': 'string', 'format': 'date'})
        self.assertTrue(validator.is_valid('2026-11-17'))
        self.assertFalse(validator.is_valid('2026-13-45'))
