# @camphoric/camphoric-event-import-tools

Tools for Camphoric event packages and the [Camphoric](https://github.com/camphoric/camphoric)
importer:

- `@camphoric/camphoric-event-import-tools/fetcher`: `CamphoricFetcher`, an authenticated client
  for the Camphoric REST API (at `CAMPHORIC_URL`, default `http://django:8000`). A request whose
  connection is reset is sent again only if it's a GET, PUT or DELETE: a POST the server may
  already have acted on could otherwise create a second record.
- `@camphoric/camphoric-event-import-tools/auth`: `getAuthToken()`, which logs in with
  `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_PASSWORD` (or asks for them). It only logs in to
  a local server (`localhost`, `127.0.0.1`, `::1`, `*.localhost`, `*.test`, or the development
  stack's `django`), so nothing that logs in through it (the fetcher, the creator, bulk
  registrations, an e2e import) changes a live server by accident: any other server is refused
  unless `CAMPHORIC_ALLOW_REMOTE=1` is set. `assertLocalServer(url)` and `isLocalServer(url)` make
  the same check.
- `@camphoric/camphoric-event-import-tools/creator`: `CamphoricEventCreator`, which imports an
  event module into a Camphoric server. Pass it the spec's `validateEventImport` as `validate`;
  the tools don't depend on any particular spec version.
- `@camphoric/camphoric-event-import-tools/organizations`: `organizationLoader()` (loads each
  organization once, creating it and its email account when missing) and `Organizations`.
- `@camphoric/camphoric-event-import-tools/e2e`: Playwright scaffolding for testing an event's
  registration form end to end. It needs `@playwright/test` (an optional peer dependency) and, for
  the throwaway server, Docker.

  ```ts
  // playwright.config.ts
  export default defineEventE2EConfig({ globalSetup: './e2e/global-setup.ts' });

  // e2e/global-setup.ts
  export default setUpEvent({ event, validate: validateEventImport });

  // e2e/registration.spec.ts
  test('the form opens', async ({ registration }) => {
    await registration.open();
    await registration.camper(1).chooseLodging('Cabins', 'Cabin 1');
    await registration.expectTotal(320);
  });
  ```

  - **The server:** `setUpEvent()` starts a throwaway Camphoric from the release image, pulled
    fresh each run (`CAMPHORIC_IMAGE_TAG` picks the tag, default `latest`;
    `CAMPHORIC_E2E_IMAGE` names a locally built image instead), imports the event, and removes the
    server when the tests end.
  - **An existing server:** `CAMPHORIC_E2E_SERVER_URL`, with `CAMPHORIC_E2E_SERVER_USERNAME` /
    `_PASSWORD` for its admin, makes it import into that server instead. Not `CAMPHORIC_URL`, so
    tests never import into a development server by accident. One that isn't local also needs
    `CAMPHORIC_ALLOW_REMOTE=1` (see `/auth` above).
  - **Registration is opened:** the imported copy's registration window is opened, so the form
    can be tested whatever its dates say (`openRegistration: false` keeps them).
  - **One shared event:** every test, on desktop and mobile Chrome, shares the one imported event.
    A registration one test completes stays, taking lodging capacity the others see.
  - **What tests use:** a `test` with `registration` (a `RegistrationForm` page object: fields by
    label, campers, lodging, the price ticker, submitting and paying) and `eventId` fixtures, and
    `expect`.
  - **Lodging:** a camper's `chooseLodging(...names)` picks a name at each level and returns the
    choices each level offered; `lodgingLevels()` is the lodging dropdowns shown now, one per
    level. A lodging offers nothing below it when no dropdown appears under it: after
    `chooseLodging('Tent')`, `expect(camper.lodgingLevels()).toHaveCount(1)`; after
    `chooseLodging('Cabins', 'Cabin 1')`, `toHaveCount(2)`. Count the dropdowns rather than open
    them: one opened and closed without a pick can leave it ignoring the next pick.
- `@camphoric/camphoric-event-import-tools/types`: the event-module types the tools use, kept
  compatible with the spec's.
- `@camphoric/camphoric-event-import-tools/bulk-registrations`: `main()` /
  `runBulkRegistrations()`, which post generated registrations to an imported event (the
  events' `addRegistrations.ts` scripts).

See the Camphoric repository's `README.md` for installing from GitHub Packages.
