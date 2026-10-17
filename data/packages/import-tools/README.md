# @camphoric/camphoric-event-import-tools

Tools for Camphoric event packages and the [Camphoric](https://github.com/camphoric/camphoric)
importer:

- `@camphoric/camphoric-event-import-tools/fetcher`: `CamphoricFetcher`, an authenticated client
  for the Camphoric REST API.
- `@camphoric/camphoric-event-import-tools/auth`: `getAuthToken()`, which logs in with
  `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_PASSWORD` (or asks for them).
- `@camphoric/camphoric-event-import-tools/bulk-registrations`: `main()` /
  `runBulkRegistrations()`, which post generated registrations to an imported event (the
  events' `addRegistrations.ts` scripts).

See the Camphoric repository's `README.md` for installing from GitHub Packages.
