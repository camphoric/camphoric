# @camphoric/camphoric-event-import-tools

Tools for Camphoric event packages and the [Camphoric](https://github.com/camphoric/camphoric)
importer:

- `@camphoric/camphoric-event-import-tools/fetcher`: `CamphoricFetcher`, an authenticated client
  for the Camphoric REST API (at `CAMPHORIC_URL`, default `http://django:8000`). A request whose
  connection is reset is sent again only if it's a GET, PUT or DELETE: a POST the server may
  already have acted on could otherwise create a second record.
- `@camphoric/camphoric-event-import-tools/auth`: `getAuthToken()`, which logs in (once per server
  per process, since Camphoric throttles sign-in) with
  `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_PASSWORD` (or asks for them). It only logs in to
  a local server (`localhost`, `127.0.0.1`, `::1`, `*.localhost`, `*.test`, or the development
  stack's `django`), so nothing that logs in through it (the fetcher, the creator, bulk
  registrations, an e2e import) changes a live server by accident: any other server is refused
  unless `CAMPHORIC_ALLOW_REMOTE=1` is set. `assertLocalServer(url)` and `isLocalServer(url)` make
  the same check.
- `@camphoric/camphoric-event-import-tools/creator`: `CamphoricEventCreator`, which imports an
  event module into a Camphoric server. Pass it the spec's `validateEventImport` as `validate`;
  the tools don't depend on any particular spec version. Group emails are matched to the event's
  saved ones by name and promo codes by code (ignoring case), so importing again updates them
  rather than adding copies; ones the event has that the data doesn't name are left alone. Once
  everything (and any sample registrations) is in, the server checks the event's templates
  (`GET /api/events/<id>/templates/check`, as `manage.py check_templates` does), and a template
  with an error fails the import, rather than its first send.
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
    server when the tests end. Its registration throttles (registering, saving drafts, opening an
    invitation, checking a promo code) allow `1000/minute` from one address, so a suite isn't told
    to wait (`CAMPHORIC_E2E_REGISTER_RATE`, `_REGISTRATION_DRAFT_RATE`, `_INVITATION_LOOKUP_RATE`
    and `_PROMO_CODE_CHECK_RATE` change them; a real server's are 10 to 30 a minute). It sends email as it's queued, to its console, keeping what it sent in its outbox
    (see `admin.emails()` below).
  - **An existing server:** `CAMPHORIC_E2E_SERVER_URL`, with `CAMPHORIC_E2E_SERVER_USERNAME` /
    `_PASSWORD` for its admin, makes it import into that server instead. Not `CAMPHORIC_URL`, so
    tests never import into a development server by accident. One that isn't local also needs
    `CAMPHORIC_ALLOW_REMOTE=1` (see `/auth` above).
  - **Registration is opened:** the imported copy's registration window is opened, so the form
    can be tested whatever its dates say (`openRegistration: false` keeps them).
  - **One shared event:** every test, on desktop and mobile Chrome, shares the one imported event.
    A registration one test completes stays, taking lodging capacity the others see.
  - **What tests use:** a `test` with these fixtures, and `expect`:
    - `registration`: a `RegistrationForm` page object (fields by label, campers, lodging, lists,
      the price ticker, submitting and paying);
    - `admin`: a `CamphoricAdmin`, what an organizer does, through the admin API as the admin the
      event was imported as (invitations, and the email sent);
    - `payPal`: a `FakePayPal`, the orders the server asked the throwaway server's fake PayPal for;
    - `eventId`: the imported event's id.
  - **Campers and lists:** `addCamper()` adds one and `removeCamper(n)` removes the nth (from 1;
    the ones after it move up). A list question (an array of objects in the schema, such as a
    camper's parking passes) is `list(title)`, on the form or a camper (a camper's list through
    `camper(n)`: on the form, every camper's list has that title): `items()` (to count),
    `item(n)` (its questions), `add()` (returns the new item's questions) and `remove(n)`:

    ```ts
    const passes = registration.camper(1).list('Parking Passes');
    const pass = await passes.add();
    await pass.select('Vehicle Type', 'Regular car');
    await passes.remove(1);
    await expect(passes.items()).toHaveCount(0);
    ```
  - **The payment step:** `choosePaymentOption(title)` picks a payment option, and
    `paymentTotal()` is what it costs as the step shows it, by check, or with `'online'`, with
    the event's e-payment handling. `payByCheck()` completes the registration.
  - **Paying online:** `setUpEvent({ ..., onlinePayment: true })` imports the event with PayPal
    enabled (a client id only the fakes accept), so the payment step offers PayPal's buttons and
    adds the handling. The throwaway server's PayPal API is then a fake (`e2eFakePayPal.py`, run
    on the app image and mounted from this package, so Docker must see its files), and the browser
    gets a fake of PayPal's script. Neither is there without `onlinePayment`, or with an existing
    server, whose own PayPal would refuse the client id: `onlinePayment` needs the throwaway
    server. `startOnlinePayment()` (or `('Card')`) presses a
    PayPal button: the registration is completed and the server creates its PayPal order, but the
    payer never approves, so nothing is paid. `payPal.order(id)` is what the server asked for,
    its amount as sent:

    ```ts
    const online = await registration.paymentTotal('online');
    const order = await payPal.order(await registration.startOnlinePayment());
    expect(order.amount).toBe(online.toFixed(2)); // to the cent, as PayPal takes it
    ```
  - **Invitations:** `admin.invite(type)` creates an invitation to register as the registration
    type with that `name`, for a new `@example.com` address (or `{ email, name }`), as the
    admin's "Invite" does, and returns its `code`, `email` and `registerUrl` (the form with the
    invitation, to `page.goto()`). `{ send: true }` emails it too.
  - **Sent email:** `admin.emails({ to, kind })` is the email the server sent about the event
    (from its outbox, newest first): each one's `kind` (`confirmation`, `invitation`, …),
    `status`, `subject`, `text` and `html`. Email is recorded before the request that sends it
    answers, so after a registration's last step it's there; `to` matches the address in any
    case. It works with an existing server too.
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

See the Camphoric repository's `README.md` for installing it.
