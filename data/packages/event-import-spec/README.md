# @camphoric/camphoric-event-import-spec

The contract a [Camphoric](https://github.com/camphoric/camphoric) event module satisfies.

- `EventImportSchema`: the event import object, written with TypeBox, so it gives both the
  `EventImport` type and the JSON Schema the importer checks. Besides the event itself (its forms,
  pricing, confirmation page, and confirmation and invoice emails), it holds the event's lodging
  tree, reports (each with an optional `category`, which groups related reports in the admin's
  report list, and `description`), custom charge types, registration types (with their
  invitation emails and schema overrides), group emails (`email_templates`) and promo codes (`promo_codes`, excluding
  registration types by name). The event may define its own offline payment types (`payment_types`, each a `value`
  and a `label`), offered alongside the built-in Check, Voucher, PayPal and Card. Every part but the organization, the event, its reports and its
  registration types is optional. It holds no runtime data (registrations, invitations, invoices,
  payments) and no email accounts, which belong to the organization.
- `validateEventImport(data)`: the importer's Ajv check. It returns the errors, or `[]`.
- The rest of the module contract: `EventModule` (what an event package exports as its default),
  `OrganizationImport`, `Override`, `SampleRegGenerator` and their helpers.
- `@camphoric/camphoric-event-import-spec/conformance`: `describeEventModule(load)`, the Jest
  checks every event package runs from its own tests: among them, that its group emails have
  distinct names, its promo codes distinct codes, that a promo code excludes only the event's
  own registration types, and that its own payment types are distinct and none is a built-in one.
- `@camphoric/camphoric-event-import-spec/tsconfig.base.json`: the compiler options event
  packages extend.

An event package takes this package as a **peer dependency** (`"^1.0.0"`), with the same range as a
devDependency for its own checks, so it shares the importer's copy. A major version is a change an
event module must follow. See the Camphoric repository's
`RELEASE.md` for which spec versions each Camphoric release supports, and its `README.md` for
installing it.
