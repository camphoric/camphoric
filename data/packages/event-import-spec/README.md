# @camphoric/camphoric-event-import-spec

The contract a [Camphoric](https://github.com/camphoric/camphoric) event module satisfies.

- `EventImportSchema`: the event import object, written with TypeBox, so it gives both the
  `EventImport` type and the JSON Schema the importer checks.
- `validateEventImport(data)`: the importer's Ajv check. It returns the errors, or `[]`.
- The rest of the module contract: `EventModule` (what an event package exports as its default),
  `OrganizationImport`, `Override`, `SampleRegGenerator` and their helpers.
- `@camphoric/camphoric-event-import-spec/conformance`: `describeEventModule(load)`, the Jest
  checks every event package runs from its own tests.
- `@camphoric/camphoric-event-import-spec/tsconfig.base.json`: the compiler options event
  packages extend.

An event package takes this package as a **peer dependency** (`"^1.0.0"`), with the same range as a
devDependency for its own checks, so it shares the importer's copy. A major version is a change an
event module must follow. See the Camphoric repository's
`RELEASE.md` for which spec versions each Camphoric release supports, and its `README.md` for
installing it.
