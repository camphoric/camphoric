# @camphoric/camphoric-event-import-tools

Tools for Camphoric event packages and the [Camphoric](https://github.com/camphoric/camphoric)
importer:

- `@camphoric/camphoric-event-import-tools/fetcher`: `CamphoricFetcher`, an authenticated client
  for the Camphoric REST API.
- `@camphoric/camphoric-event-import-tools/auth`: `getAuthToken()`, which logs in with
  `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_PASSWORD` (or asks for them).
- `@camphoric/camphoric-event-import-tools/creator`: `CamphoricEventCreator`, which imports an
  event module into a Camphoric server. Pass it the spec's `validateEventImport` as `validate`;
  the tools don't depend on any particular spec version.
- `@camphoric/camphoric-event-import-tools/organizations`: `organizationLoader()` (loads each
  organization once, creating it and its email account when missing) and `Organizations`.
- `@camphoric/camphoric-event-import-tools/types`: the event-module types the tools use, kept
  compatible with the spec's.
- `@camphoric/camphoric-event-import-tools/bulk-registrations`: `main()` /
  `runBulkRegistrations()`, which post generated registrations to an imported event (the
  events' `addRegistrations.ts` scripts).

See the Camphoric repository's `README.md` for installing from GitHub Packages.
