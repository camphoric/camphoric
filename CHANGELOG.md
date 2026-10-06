# Changelog

## [0.12.0](https://github.com/camphoric/camphoric/compare/v0.11.0...v0.12.0) (2026-10-06)


### ⚠ BREAKING CHANGES

* **server:** registration_start/registration_end must be written as ISO timestamps with an offset; a plain YYYY-MM-DD is refused.

### Bug Fixes

* **client_v2:** keep the country when a phone number is autofilled ([04df400](https://github.com/camphoric/camphoric/commit/04df4004e965973e6decd151f7b4affe05e2978d)), closes [#746](https://github.com/camphoric/camphoric/issues/746)
* **client_v2:** pick the registration window in the camp's time zone ([88fa97a](https://github.com/camphoric/camphoric/commit/88fa97a2bd88c04c841e607f6820a5fb231a6ab5))
* **data:** import the registration window as timestamps ([9118269](https://github.com/camphoric/camphoric/commit/91182693857bfd0df40c73cbbadaced7679c4c4c))
* **server:** make the registration window date and time, in the event's time zone ([55af16a](https://github.com/camphoric/camphoric/commit/55af16ab4528407583011f59714456d21ab6f500)), closes [#744](https://github.com/camphoric/camphoric/issues/744)

## [0.11.0](https://github.com/camphoric/camphoric/compare/v0.10.1...v0.11.0) (2026-10-05)


### ⚠ BREAKING CHANGES

* **client_v2:** needs the server's invoice API.
* **server:** the register payment step takes paymentOption and paypalOrderId; Registration loses payment_type, initial_payment and paypal_response; Payment.paypal_order_details is renamed paypal_response.

### Features

* **client_v2:** add a Markdown tab to Template Help ([fbe82a4](https://github.com/camphoric/camphoric/commit/fbe82a45370b655627bcd071b10787764668cfa7))
* **client_v2:** ask before leaving Home with any unsaved change ([73f3995](https://github.com/camphoric/camphoric/commit/73f399530e158acfcc703501c7b22aa3a4f7769e))
* **client_v2:** ask before leaving unsaved template changes ([637f083](https://github.com/camphoric/camphoric/commit/637f083d36105abbe8d21a6ce6c3e79518ff0db6))
* **client_v2:** call a signed-out change's author "Anonymous User" ([b49b291](https://github.com/camphoric/camphoric/commit/b49b2919c13f1cd82207395a504d9ac1dbb66330))
* **client_v2:** head each section of a JSON diff with where it is ([6fd0f8d](https://github.com/camphoric/camphoric/commit/6fd0f8dc6ca97a9bbb693471c6f0718424f224a5))
* **client_v2:** make, send and pay invoices ([0579060](https://github.com/camphoric/camphoric/commit/0579060290669c8fbc2b7db218ce739bc9be1ad1))
* **client_v2:** open Users as an overlay over the current page ([dd3d49d](https://github.com/camphoric/camphoric/commit/dd3d49d5981d196872f4f0494608d0fa3776f079))
* **client_v2:** pay with server payment options; manage invoices ([86ec0a8](https://github.com/camphoric/camphoric/commit/86ec0a8d2f9079d7b6802daf39f62a1f5354e2ca))
* document the methods of Python values in Jinja templates ([aa85c39](https://github.com/camphoric/camphoric/commit/aa85c396da5ed0b74abd915e750132c12392319e)), closes [#738](https://github.com/camphoric/camphoric/issues/738)
* **server:** admin invoices, invoice emails and a public pay page ([9f69236](https://github.com/camphoric/camphoric/commit/9f692361d82bd8f46c5e822728cdb55bb1f4d3d9)), closes [#670](https://github.com/camphoric/camphoric/issues/670) [#623](https://github.com/camphoric/camphoric/issues/623)
* **server:** keep every payment on an invoice, charge handling per invoice ([8eb1f26](https://github.com/camphoric/camphoric/commit/8eb1f263f6458a794ca742953afd0a56eec37c11))
* show a user's change history in Users, with diffs of long changes ([4f97fec](https://github.com/camphoric/camphoric/commit/4f97fec6ddeb6b587dcc935c540794ed5838d097))


### Bug Fixes

* **client_v2:** don't nest a heading in the Users overlay's title ([58e0954](https://github.com/camphoric/camphoric/commit/58e0954e72224d52b4de0cc4876f0500fc75afb6))
* **client_v2:** label the registrations list's amount column "Total" ([d926a84](https://github.com/camphoric/camphoric/commit/d926a84ff727cf93706ad39509cf5fed4e922e12))
* **client_v2:** put the event chooser's back arrow left of the title ([feef422](https://github.com/camphoric/camphoric/commit/feef4225e35e3adadc2f9d1b1d36d5339ead5b26))
* **client_v2:** write and read search params as plain strings ([6a3711e](https://github.com/camphoric/camphoric/commit/6a3711edf86cf2ea34f06b12a633c8471eb5ce26))
* **harmony:** show tuition in the Camperships Awarded report ([f7da741](https://github.com/camphoric/camphoric/commit/f7da741479077cec0faf2f48a23880afde6be07c))

## [0.10.1](https://github.com/camphoric/camphoric/compare/v0.10.0...v0.10.1) (2026-10-02)


### Bug Fixes

* **harmony:** show the camper fees total in confirmation email ([e9a5950](https://github.com/camphoric/camphoric/commit/e9a59507d386defd67972fe695a5d1cf680f4253))

## [0.10.0](https://github.com/camphoric/camphoric/compare/v0.9.0...v0.10.0) (2026-10-02)


### Features

* **client_v2:** collapse sections of the lodging hierarchy ([f89f9ef](https://github.com/camphoric/camphoric/commit/f89f9ef3d3b105b38ff4044e15a1e7a8d3b5f033))
* **client_v2:** give the template editor room to write ([9767d49](https://github.com/camphoric/camphoric/commit/9767d494bf5eafd1035d9335043465120aceba58))
* **client_v2:** go back to organization selection from the event chooser ([991079c](https://github.com/camphoric/camphoric/commit/991079c70313f9f75448bb9eb6bf4e22d099683d))
* **client_v2:** list a unit's campers on one line in the lodging hierarchy ([4539b56](https://github.com/camphoric/camphoric/commit/4539b569bd685add64897b3cb7330ba819f8758e))
* **client_v2:** lodging notes and node details on the hierarchy and timeline ([c8c27d9](https://github.com/camphoric/camphoric/commit/c8c27d961e61e7265fa9b8a991c274727cd947a9))
* **client_v2:** rename the lodging views and offer Edit on both ([f1d1b9c](https://github.com/camphoric/camphoric/commit/f1d1b9c1804f45f466c2a959aedb03be0136122f))
* **client_v2:** show a camper's lodging in the camper editor ([34898f0](https://github.com/camphoric/camphoric/commit/34898f09a3a0f0de562487f545ba79ab53c113e5))
* **client_v2:** widen the camper and registration editors ([0ec08c1](https://github.com/camphoric/camphoric/commit/0ec08c172dba7609178afad584db6f275369d308))
* keep the handling fee paid online, and round it alike everywhere ([c56e87c](https://github.com/camphoric/camphoric/commit/c56e87c21b15959fb798aa934dd0c1ea5dc47596)), closes [#622](https://github.com/camphoric/camphoric/issues/622)
* **server:** delete abandoned registrations nightly ([b036d9c](https://github.com/camphoric/camphoric/commit/b036d9c18672bb1df5990bb41fab8fa0ddc8925e)), closes [#339](https://github.com/camphoric/camphoric/issues/339)
* **server:** require a total in camper and registration pricing logic ([4dbec71](https://github.com/camphoric/camphoric/commit/4dbec71e1d7179c77a40d574c4682c3ed0b40ca3))


### Bug Fixes

* **client_v2:** keep PayPal's card form usable on the payment page ([0ec2402](https://github.com/camphoric/camphoric/commit/0ec24023154a17b5430aee07db0b9f252681211a)), closes [#646](https://github.com/camphoric/camphoric/issues/646)
* **client_v2:** scroll rendered reports in their own area ([7cb03dc](https://github.com/camphoric/camphoric/commit/7cb03dc4a85b16933dd43a170724191a167a4c22))
* **client_v2:** stop timeline stays flashing back after a change ([abb63db](https://github.com/camphoric/camphoric/commit/abb63db0fb30e9c09b065d089a800cc8bae611fc))
* **data:** import lodging notes ([fb6e31b](https://github.com/camphoric/camphoric/commit/fb6e31b051b3ffab5dd994ed03ecc2e216db09b4))
* **docker:** make the postgres healthcheck work on Alpine ([07d3755](https://github.com/camphoric/camphoric/commit/07d3755942f11427a6eeb1a0a5ea85aba5640d08))
* **harmony:** show private room request in confirmation email ([b32be25](https://github.com/camphoric/camphoric/commit/b32be2521ced9fdf6c8a4e1f5b5410bcff880a4b)), closes [#733](https://github.com/camphoric/camphoric/issues/733)
* **server:** validate registrations as JSON Schema draft 7 ([426dfcd](https://github.com/camphoric/camphoric/commit/426dfcdf2e17cfc49dfe9dd8342f4c32c8e438d7))

## [0.9.0](https://github.com/camphoric/camphoric/compare/v0.8.1...v0.9.0) (2026-10-01)


### Features

* **client_v2:** enter and manage promo codes ([36b9171](https://github.com/camphoric/camphoric/commit/36b9171a4b7fe043094369cc2344777aa03bb92f)), closes [#651](https://github.com/camphoric/camphoric/issues/651)
* **client_v2:** rework lodging assignment for placing campers ([83294af](https://github.com/camphoric/camphoric/commit/83294af838b93b1dd502de925d1b9d576c05cc68)), closes [#705](https://github.com/camphoric/camphoric/issues/705)
* **client_v2:** show the event in the admin header and keep tabs in the URL ([42af5b7](https://github.com/camphoric/camphoric/commit/42af5b78eb28cbc7896fd8e034d690da632cdc3f))
* **server:** add promo codes for registration ([39eff1c](https://github.com/camphoric/camphoric/commit/39eff1cc3135e63b878e1f120f68ad35c913807a)), closes [#651](https://github.com/camphoric/camphoric/issues/651)


### Bug Fixes

* **ansible:** migrate before loading sample data ([da9ed7b](https://github.com/camphoric/camphoric/commit/da9ed7bc2d30f23551cdef6f6d87ce2be1b72150))
* **client_v2:** list lodging units in tree order ([dfd1930](https://github.com/camphoric/camphoric/commit/dfd1930c9b82b63c0a1b5251746f5c89673aac98))
* **client_v2:** never price a camper or registration below zero ([18b794d](https://github.com/camphoric/camphoric/commit/18b794d4be1e9bc5b975cf8c6491000e7d276d1a)), closes [#714](https://github.com/camphoric/camphoric/issues/714)
* **client_v2:** save checkbox choices in option order ([e3d1555](https://github.com/camphoric/camphoric/commit/e3d155533f243515fed6ae433644caa10bd777e1)), closes [#708](https://github.com/camphoric/camphoric/issues/708)
* **client_v2:** show the description on checkbox fields ([d9f5d7c](https://github.com/camphoric/camphoric/commit/d9f5d7c9b9219404d324d5a396c58f9e71d72a50))
* **client_v2:** type the tab search reducer's params as strings ([8798f8d](https://github.com/camphoric/camphoric/commit/8798f8d07e683952033969f8859c2b08145f7d44))
* **deps:** bump @tanstack/react-router ([778b007](https://github.com/camphoric/camphoric/commit/778b00712b7528f2cb3691321ff10e4d8571cac8))
* **deps:** bump chalk in /data in the minor-and-patch group ([224928e](https://github.com/camphoric/camphoric/commit/224928ee154e921eee573dfaa4e0a48c12466a0a))
* **deps:** bump inquirer from 12.11.1 to 14.2.2 in /data ([ce29b38](https://github.com/camphoric/camphoric/commit/ce29b382b9ee553e6d11fdb496d118ee82ebbbd8))
* **deps:** bump ora from 8.1.0 to 9.4.1 in /data ([ef85db9](https://github.com/camphoric/camphoric/commit/ef85db90e7f88c1eb181c781627215190f5f2932))
* **harmony:** change lodging description ([f53a326](https://github.com/camphoric/camphoric/commit/f53a326a4d8da5367a3ebcad628a7ff45bfb9556)), closes [#711](https://github.com/camphoric/camphoric/issues/711)
* **harmony:** change title/desc for attendance ([1ad56ba](https://github.com/camphoric/camphoric/commit/1ad56ba5b8c86ac66d4ca21cd2736b2ae1d50021)), closes [#710](https://github.com/camphoric/camphoric/issues/710)
* **harmony:** fix dates for Camp Harmony 2026 ([51a1cf9](https://github.com/camphoric/camphoric/commit/51a1cf998ef871a898b7acbec97146cb2e4d2377)), closes [#709](https://github.com/camphoric/camphoric/issues/709)
* **harmony:** fix workshop form text ([f0acbb3](https://github.com/camphoric/camphoric/commit/f0acbb33114f2daae929134dfdd30e3267cbf0ba)), closes [#713](https://github.com/camphoric/camphoric/issues/713)
* **harmony:** text changes to confirmation email ([dce5e5b](https://github.com/camphoric/camphoric/commit/dce5e5b1f5e675f1873e45535a62fd21de26fe93)), closes [#712](https://github.com/camphoric/camphoric/issues/712)
* **server:** never price a camper or registration below zero ([881b7fd](https://github.com/camphoric/camphoric/commit/881b7fdc62f4ecde02552d522a4c9a25f1a64142)), closes [#714](https://github.com/camphoric/camphoric/issues/714)

## [0.8.1](https://github.com/camphoric/camphoric/compare/v0.8.0...v0.8.1) (2026-09-29)


### Bug Fixes

* **client_v2:** bundle Monaco instead of loading it from a CDN ([10916a5](https://github.com/camphoric/camphoric/commit/10916a5bed3276db56cd713666e40cb14a9d371a))
* **client_v2:** keep Monaco editors from dropping fast keystrokes ([bd659ef](https://github.com/camphoric/camphoric/commit/bd659eff71000a4e75a90ec51c408d54d88f5597))
* **client_v2:** show campers on a lodging branch as unassigned ([9908393](https://github.com/camphoric/camphoric/commit/9908393a014e7d12ee5ef1a5bd629c8080815b5d))
* **client_v2:** show campers placed above a leaf as Unassigned ([67c2835](https://github.com/camphoric/camphoric/commit/67c2835437813cf9fe6641b083ab27087fd70196))
* **deps:** bump chalk from 5.3.0 to 6.0.0 in /data ([78ef754](https://github.com/camphoric/camphoric/commit/78ef7541fdde157e74b50223e164436529d89595))
* **deps:** bump dotenv from 16.4.5 to 18.0.4 in /data ([1e46eb4](https://github.com/camphoric/camphoric/commit/1e46eb47d923368b3abfe4b2373b67c06ce078ee))
* **deps:** bump moment in /data in the minor-and-patch group ([c40a38c](https://github.com/camphoric/camphoric/commit/c40a38ce945ef547072599db7f2d871f08ba2460))
* **deps:** bump the minor-and-patch group in /client_v2 with 18 updates ([be08172](https://github.com/camphoric/camphoric/commit/be08172ca864c5142fbabc9ebee343764acce9ee))
* **deps:** refresh client_v2 and data lockfiles for security fixes ([59a8e87](https://github.com/camphoric/camphoric/commit/59a8e871582a672efecd9f5e1760c93d15ef917e))
* **deps:** upgrade inquirer to 12 in the data importer ([78708ee](https://github.com/camphoric/camphoric/commit/78708ee59e886b7a5e4d1aaf540ec4f443116ee3))
* **deps:** upgrade vitest to 4.1.11 in client_v2 ([48f9e0c](https://github.com/camphoric/camphoric/commit/48f9e0c7622b10995b607a7b0a172935d0b589ae))

## [0.8.0](https://github.com/camphoric/camphoric/compare/v0.7.0...v0.8.0) (2026-09-27)


### ⚠ BREAKING CHANGES

* **api:** DELETE on registrations, campers and payments no longer removes the rows, and deleted_at can no longer be written.
* **api:** DELETE on events is Admin-only and refused once anyone has registered; deleting a lodging, registration type or deposit no longer deletes campers, registrations or payments; deleting a charge type in use is a 409.
* **auth:** /api/users/ has a new contract. It requires email and role, and accepts only the managed fields; is_staff, is_superuser, groups and user_permissions can't be written.
* **auth:** the admin API needs a Camphoric permission group, not just is_staff. Staff accounts that aren't superusers become Registrars through the migration; staff created later need a group.

### Features

* **api:** give invitations their registration link, and fix adding campers ([84fd347](https://github.com/camphoric/camphoric/commit/84fd34772d957a018ccfd8d155ce305ec0616e45)), closes [#486](https://github.com/camphoric/camphoric/issues/486)
* **api:** soft-delete registrations, campers and payments, with restore ([f4477cd](https://github.com/camphoric/camphoric/commit/f4477cd426932e7d8fc6eec8570490dbeac513a3)), closes [#652](https://github.com/camphoric/camphoric/issues/652)
* **audit:** record who changed what in the admin ([954feb6](https://github.com/camphoric/camphoric/commit/954feb67892e0dbbd697a8d3392af9c7f818b828)), closes [#652](https://github.com/camphoric/camphoric/issues/652)
* **auth:** add Admin, Registrar and Reporter roles ([6dd4dde](https://github.com/camphoric/camphoric/commit/6dd4dde46c0df7578fa5d4d43f9698d3927aa62e))
* **auth:** manage users, reset passwords by emailed link, and let superusers set passwords ([c76406f](https://github.com/camphoric/camphoric/commit/c76406fb4dd2fc503faa62db285f0d08c88076ad))
* **client_v2:** add a camper to a registration, and copy an invitation's link ([6ae523b](https://github.com/camphoric/camphoric/commit/6ae523ba1421dc2d0a97c13e928f02c2b1b36b96)), closes [#486](https://github.com/camphoric/camphoric/issues/486)
* **client_v2:** add user and organization administration and password pages ([3fe8d14](https://github.com/camphoric/camphoric/commit/3fe8d14aca7321782e639618d1b302829ad76f93))
* **client_v2:** make the admin read-only for Reporters ([0e75f80](https://github.com/camphoric/camphoric/commit/0e75f801a42724e938d4d3c139b3c5e737de2353))
* **client_v2:** override a registration's or camper's price lines ([6eb3ba5](https://github.com/camphoric/camphoric/commit/6eb3ba5d963ddf2fb1e5676e3fe38c3a4be1fe78)), closes [#667](https://github.com/camphoric/camphoric/issues/667)
* **client_v2:** show change history and restore deleted registrations, campers and payments ([9eea923](https://github.com/camphoric/camphoric/commit/9eea923abbfc08850c25b578b025a3e8bf202c8c)), closes [#652](https://github.com/camphoric/camphoric/issues/652)
* **lodging:** let organizers mark lodging full or open ([302b438](https://github.com/camphoric/camphoric/commit/302b438281d5e9ad688f891fb906a1c0a4e3640d)), closes [#602](https://github.com/camphoric/camphoric/issues/602)
* **pricing:** let registrars override a price line ([7767803](https://github.com/camphoric/camphoric/commit/77678030ddcc074d88061b854ea678c8eb45f0bd)), closes [#667](https://github.com/camphoric/camphoric/issues/667)


### Bug Fixes

* **api:** refuse public registrations outside the registration dates without an invitation ([ce63fff](https://github.com/camphoric/camphoric/commit/ce63fff3ad1b790eb37352615054a11538b21b50)), closes [#296](https://github.com/camphoric/camphoric/issues/296)
* **api:** say why a registration's invitation was rejected ([4152a49](https://github.com/camphoric/camphoric/commit/4152a4901d69c2c3c585bbbcfb928843b339599e))
* **api:** stop deletes from removing registrations, campers and payments ([f2c8e13](https://github.com/camphoric/camphoric/commit/f2c8e13f2e8a8f718c1456e6ea1f301af3fe5b90)), closes [#652](https://github.com/camphoric/camphoric/issues/652)
* **audit:** name a deleted user by their email in histories ([6009587](https://github.com/camphoric/camphoric/commit/6009587a6c310e1a4e0b309b2a3b2f991a4bc004)), closes [#652](https://github.com/camphoric/camphoric/issues/652)
* **client_v2:** allow negative custom charges for discounts and credits ([a087cab](https://github.com/camphoric/camphoric/commit/a087cab3f5574ba734233e5f525d44c4c73d28dd)), closes [#671](https://github.com/camphoric/camphoric/issues/671)
* **client_v2:** disable the Address field's inputs in a disabled form ([5a2bc43](https://github.com/camphoric/camphoric/commit/5a2bc436bd9d6b5006e5b0ecd6aa6dba8b2a295f))
* **client_v2:** lay out list fields like sections, one box per item ([d025540](https://github.com/camphoric/camphoric/commit/d0255404f94b63d50e30c7cda03de8a1dfbcfac2))
* **client_v2:** leave $0 lines out of the registration review's pricing ([fcd4474](https://github.com/camphoric/camphoric/commit/fcd44749c8b91fc48575e3ff0e1ffc37dffc8f2e)), closes [#666](https://github.com/camphoric/camphoric/issues/666)
* **client_v2:** replace Lark-only camper columns with requested lodging and fellow campers ([452e3b1](https://github.com/camphoric/camphoric/commit/452e3b1bdc90b03fa93cbf20c94b2b6e06836501))
* **client_v2:** say "View" rather than "Edit" on automatic email links for Reporters ([3983bfb](https://github.com/camphoric/camphoric/commit/3983bfbca45063eb57ec6902004538005e3792c6))
* **data:** stop printing blank names for Lark parking passes ([4f8e33d](https://github.com/camphoric/camphoric/commit/4f8e33d6eff81677f36049eaf8fd13a5ada2bb1e)), closes [#672](https://github.com/camphoric/camphoric/issues/672)

## [0.7.0](https://github.com/camphoric/camphoric/compare/v0.6.0...v0.7.0) (2026-09-26)


### ⚠ BREAKING CHANGES

* **email:** the /api/bulkemailtasks/, /api/bulkemailrecipients/ and /api/events/<id>/bulkemail/recipients endpoints and the send_bulk_email command are removed, and existing bulk email tasks are deleted by migration 0067. Use email templates with purpose "group" and /api/emailtemplates/<id>/send/ instead.
* **email:** events and registration types no longer have confirmation_email_subject/template/engine or invitation_email_subject/template/engine; edit their email templates instead (confirmation_template / invitation_template). Mustache emails are converted to Jinja by the migration.
* an existing docker-compose database volume made by PostgreSQL 15 won't open in 16. Recreate it (docker-compose down -v, then ./reset-db) or dump it first and restore it; see doc/development.md.
* the server requires Python 3.12+ and PostgreSQL 15+. Hosts on Ubuntu 22.04's packages (Python 3.10, PostgreSQL 14) must be upgraded before deploying this release.
* confirmation pages are Jinja, not Handlebars, and the payment step returns confirmationPage (rendered markdown) instead of confirmationPageTemplate. Existing events' pages must be rewritten in Jinja; until then registrants see a generic thank-you and the organizer is sent the problems.
* API clients that create reports, registration types, events or bulk emails without variables_source/engine now get 'server' variables and Jinja templates. Send 'client'/'mustache' explicitly to keep the legacy behavior.

### Features

* bulk email to registrations or campers from the v2 admin ([2f260e4](https://github.com/camphoric/camphoric/commit/2f260e45a2c1556481641a9d014aee4f5b671b4c)), closes [#654](https://github.com/camphoric/camphoric/issues/654) [#653](https://github.com/camphoric/camphoric/issues/653)
* **data:** convert Harmony reports to server variables ([d923ed8](https://github.com/camphoric/camphoric/commit/d923ed8a7103b8397a444bb837061f551ac58502))
* **data:** convert Lark, Jughandle and Family Week reports to server variables ([419d8e4](https://github.com/camphoric/camphoric/commit/419d8e45e16a64ff8fb62a86fccf0b9d2888215c))
* **email:** add group email templates with a recipient rule builder ([9660fc8](https://github.com/camphoric/camphoric/commit/9660fc8b2ef1659210f8875381c478f498662e89))
* **email:** add the email history, queue and account API ([25f8fed](https://github.com/camphoric/camphoric/commit/25f8fed83405e8bf79f0435c5bc39c3909f40a8d))
* **email:** add the email outbox with retries and per-account limits ([ac18f7f](https://github.com/camphoric/camphoric/commit/ac18f7fb27f42382baee84ce3bc3c6d398a58dad))
* **email:** default Reply-To to the sender ([d4d2bb1](https://github.com/camphoric/camphoric/commit/d4d2bb1f98f5c4e4ec3081ac9d474a2f616e5611))
* **email:** make every email a Jinja email template ([34e5a0c](https://github.com/camphoric/camphoric/commit/34e5a0ccfd07a515a9424d29843570c4ae7d066f))
* **email:** manage email accounts and show invitation delivery ([74f8a12](https://github.com/camphoric/camphoric/commit/74f8a12d248616c679be7412eba9bc9ae40fb3fb))
* **email:** one-click unsubscribe from an event's group email ([3cfa778](https://github.com/camphoric/camphoric/commit/3cfa77836295a5c3db2998c182b9e2c092ab5fe3))
* **email:** queue confirmations, problem reports and invitations ([ed7fa84](https://github.com/camphoric/camphoric/commit/ed7fa84cb7bc236b6528f148eedcd4c3099764cb))
* **email:** remove task-based bulk email in favor of group email ([4d042fd](https://github.com/camphoric/camphoric/commit/4d042fd8da098fcc0f713b9b8acfb8ba2ddaf6d3))
* **email:** review, send and follow group emails ([b575bbe](https://github.com/camphoric/camphoric/commit/b575bbee61b959f9fd1c6eac8b113abab7886b4b))
* **email:** run the task worker that delivers queued email ([4722eed](https://github.com/camphoric/camphoric/commit/4722eed5eefb55bf2a0022e15a80fe85d32d63b0))
* **email:** send group emails from templates in batches ([0d9a9d9](https://github.com/camphoric/camphoric/commit/0d9a9d969a18dc9fcc28a251fe84bb76d25ef93f))
* **email:** show the email history and queue in the admin ([571c02c](https://github.com/camphoric/camphoric/commit/571c02ca1a55b36394f1e256d655659c47ce93dc))
* Jinja confirmation and invitation emails with per-template engines ([8017677](https://github.com/camphoric/camphoric/commit/8017677bebbbe48d788ae97dc4a2a175eb2c82c8))
* Jinja emails and server-variable reports by default ([1064a5a](https://github.com/camphoric/camphoric/commit/1064a5ad4ed016b84ed55660badbdb3487e5033a))
* render the confirmation page on the server ([1e91364](https://github.com/camphoric/camphoric/commit/1e91364842f9dc52145801f900bdb2e0de573174))
* server-rendered report type with a Jinja template editor ([f332c80](https://github.com/camphoric/camphoric/commit/f332c8057e53780aee10d72cd384dea95fe7134a))
* **server:** server-side Jinja templating core ([3c0d527](https://github.com/camphoric/camphoric/commit/3c0d527524f9a1bba714080a386e5594e8e93993))
* Template Help for server-rendered Jinja templates ([462f713](https://github.com/camphoric/camphoric/commit/462f7132aa9b11f33bd43adc8e8d8660042f83e4))


### Bug Fixes

* **ansible:** flush the database only on reset tags ([256a13e](https://github.com/camphoric/camphoric/commit/256a13e810035d19ca883b6888a8a2f84f11e964))
* **ansible:** load sample data only into an empty database ([5346287](https://github.com/camphoric/camphoric/commit/5346287070fbdde7db3b702700cbe3665e6d5f64))
* **ansible:** reload sample data after a reset on Django 6 ([10072db](https://github.com/camphoric/camphoric/commit/10072db53a56afe965fae38bdc8be17f863d4ac7))


### Performance Improvements

* **email:** send an account's due email over one connection ([900ae72](https://github.com/camphoric/camphoric/commit/900ae727eec399269b7dc7e2328d5529ab73d6e3))


### Build System

* make PostgreSQL 16 the tested and assumed version ([3ee9d0a](https://github.com/camphoric/camphoric/commit/3ee9d0a7e4d5518eacea3735192c74e7eeffb92e))
* upgrade to Django 6.1 ([4f887f1](https://github.com/camphoric/camphoric/commit/4f887f1b240d8f32cb314aa6344d5c9455963b07))

## [0.6.0](https://github.com/camphoric/camphoric/compare/v0.5.0...v0.6.0) (2026-09-24)


### Features

* **client_v2:** larger text and higher-contrast descriptions ([8114304](https://github.com/camphoric/camphoric/commit/8114304d7208b0f12419a89a655285446987febe)), closes [#656](https://github.com/camphoric/camphoric/issues/656)
* **client_v2:** manage validation messages in Settings ([8b0c74c](https://github.com/camphoric/camphoric/commit/8b0c74cfd1b42b071f1505b763971367b7010c29))
* **client_v2:** readable, per-event validation messages ([04ef03a](https://github.com/camphoric/camphoric/commit/04ef03a94363e4ab346ff7b76abef7afbd73ead9))
* **data:** import per-event validation messages ([832ecb5](https://github.com/camphoric/camphoric/commit/832ecb567037c959b4d50f8246048a9a2751092c))
* **server:** store per-event validation messages ([464f594](https://github.com/camphoric/camphoric/commit/464f59446176b07529025024991677293d6fb5e3))


### Bug Fixes

* **client_v2:** focus the first field with an error after a failed submit ([323a46a](https://github.com/camphoric/camphoric/commit/323a46acac83fcb783a4ab37e8c505b600c60384))
* **harmony:** fix harmony membership text ([c069018](https://github.com/camphoric/camphoric/commit/c069018df1ab4d3677dbc53dadc1485ece2ee1b8)), closes [#655](https://github.com/camphoric/camphoric/issues/655)
* **harmony:** make lodging error messages more generic ([b1583c1](https://github.com/camphoric/camphoric/commit/b1583c11feb4faa0984d33d13c6eba4f7de36858))
* **harmony:** remove country from address ([37e9585](https://github.com/camphoric/camphoric/commit/37e9585bea81fcfcb07e7d2ed71d88b307768bb8)), closes [#657](https://github.com/camphoric/camphoric/issues/657)

## [0.5.0](https://github.com/camphoric/camphoric/compare/v0.4.1...v0.5.0) (2026-09-24)


### Features

* **client_v2:** box each camper in the registration form ([55f1075](https://github.com/camphoric/camphoric/commit/55f1075f7f82997cbddec9c50ca6132cef755860))
* **client_v2:** opt-in debug logging of registration form changes ([256353e](https://github.com/camphoric/camphoric/commit/256353e21a49d93b38ea5b78054d6a9a35e1c5cf))
* **client_v2:** review the registration on the payment step ([dbd7c10](https://github.com/camphoric/camphoric/commit/dbd7c100460ac389d4f6774fb4871fc0497bf90d))


### Bug Fixes

* **client_v2:** show labeled booleans as dropdowns and describe every widget ([725cf03](https://github.com/camphoric/camphoric/commit/725cf03f540ea04eb820746b20dda539edf1d355)), closes [#645](https://github.com/camphoric/camphoric/issues/645)
* **client_v2:** size the pay-by-check button like the PayPal buttons ([a38d0f3](https://github.com/camphoric/camphoric/commit/a38d0f36f85cfe34adbe9d3cf9ead81f48495b3e))
* **client_v2:** update ui for PayPal buttons ([959d1c5](https://github.com/camphoric/camphoric/commit/959d1c53e5d141bb96b034a60608238619f1b284))
* **data:** put uiSchema entries at their field paths ([95845ff](https://github.com/camphoric/camphoric/commit/95845ff98ebd4cdc276eff3703ef55dd87963889)), closes [#642](https://github.com/camphoric/camphoric/issues/642)
* fix harmony early bird and reg close dates ([490424e](https://github.com/camphoric/camphoric/commit/490424ed62db233308b6b647ab1d5620635c7bb0)), closes [#647](https://github.com/camphoric/camphoric/issues/647)
* **server:** let events extend the lodging field's uiSchema per field ([7b06815](https://github.com/camphoric/camphoric/commit/7b068158cf28ecc56e3856eb424b02951a473cfd))
* update campership request description ([4182e12](https://github.com/camphoric/camphoric/commit/4182e124bb450a6332fa02808aff66a74b321c2c)), closes [#644](https://github.com/camphoric/camphoric/issues/644)
* update harmony covid policy ([5709fc2](https://github.com/camphoric/camphoric/commit/5709fc2cb60d81a34b2fc90a0d9df57342c731af)), closes [#638](https://github.com/camphoric/camphoric/issues/638)
* update link to camp harmony rates ([4246321](https://github.com/camphoric/camphoric/commit/42463211dec6d416b2e7fd1c6205d7dab2b3781f)), closes [#639](https://github.com/camphoric/camphoric/issues/639)
* Update text and logic for harmony single rooms ([a6a3a15](https://github.com/camphoric/camphoric/commit/a6a3a15def091a1ec8d756d20f079ab1d9f0ebe7)), closes [#643](https://github.com/camphoric/camphoric/issues/643)

## [0.4.1](https://github.com/camphoric/camphoric/compare/v0.4.0...v0.4.1) (2026-09-23)


### Bug Fixes

* village 7 should be visible for campers ([09b8a04](https://github.com/camphoric/camphoric/commit/09b8a041d4e68a53e0d4511690f98c17b93cf3a4))

## [0.4.0](https://github.com/camphoric/camphoric/compare/v0.3.0...v0.4.0) (2026-09-23)


### Features

* **data:** refresh Camp Harmony reports and regenerate their dates on import ([fd8dd4b](https://github.com/camphoric/camphoric/commit/fd8dd4bfeeeaaec5023c54903d5fd448e88b94c2))
* publish a container image with the v2 frontend on every release ([2f9dccc](https://github.com/camphoric/camphoric/commit/2f9dcccd0444eac8cdbff6c41d37d8b310622af3))
* validate every event in data/ offline and on import in CI ([f152d27](https://github.com/camphoric/camphoric/commit/f152d273b4168508faa186be667e156410e6bcb9))


### Bug Fixes

* add harmony lodging for 2026 ([cc8325e](https://github.com/camphoric/camphoric/commit/cc8325e469ec4af6acf3eb38d3203babe25050f7)), closes [#630](https://github.com/camphoric/camphoric/issues/630)
* repair the Camp Harmony event data ([db4c769](https://github.com/camphoric/camphoric/commit/db4c76980276a3581b96ba61441fbd59ea42db30))
* update Harmony campership limits ([3bbec59](https://github.com/camphoric/camphoric/commit/3bbec59394c8c670fe0ef75d305cec8596279abd)), closes [#634](https://github.com/camphoric/camphoric/issues/634)
* update harmony pricing for 2026 ([6b051ff](https://github.com/camphoric/camphoric/commit/6b051fffb854481705b94e3af62a127c8b9a3803)), closes [#629](https://github.com/camphoric/camphoric/issues/629)

## [0.3.0](https://github.com/camphoric/camphoric/compare/v0.2.0...v0.3.0) (2026-09-20)


### Features

* add the v2 frontend as a second release asset ([1ccde4d](https://github.com/camphoric/camphoric/commit/1ccde4d6e6d9f0c18f1e1a406500c80402182396))
* Create the V2 client ([1b18385](https://github.com/camphoric/camphoric/commit/1b183859b5703bae3c72b0747b34a2792e7945e2))


### Bug Fixes

* Add updates for Camp Harmony ([1a6976e](https://github.com/camphoric/camphoric/commit/1a6976e7be3dbbb7985d821ba5592866ff32f4fe))
* build release assets for root-component releases ([5cbe061](https://github.com/camphoric/camphoric/commit/5cbe061d7294b6b2cdd634141b29516d006a523a))
* fix payment/charge amounts rendering as $0.00 ([2984be8](https://github.com/camphoric/camphoric/commit/2984be8e645b82269ac05567fbbee9766b0138a7))

## [0.2.0](https://github.com/camphoric/camphoric/compare/v0.1.0...v0.2.0) (2026-09-19)


### Features

* add versioned releases with GitHub Release assets ([bb48b3b](https://github.com/camphoric/camphoric/commit/bb48b3b208217618a6066e5a47db30655d2e5835))


### Bug Fixes

* 415 - Update harmony confirmation email ([ef0ac89](https://github.com/camphoric/camphoric/commit/ef0ac89cf5289c0b8d17986fc38e2e7cacf8e057))
* 419 - harmony preSubmit template ([2f36c1c](https://github.com/camphoric/camphoric/commit/2f36c1c53cdf17c20a40f286b133d2dc7720e0e6))
* 427 - Note required fields ([ecb3b3d](https://github.com/camphoric/camphoric/commit/ecb3b3d204db96d7b4512ad4b255305d1c36182b))
* 428 - make campership request optional ([e60afbc](https://github.com/camphoric/camphoric/commit/e60afbcc95c1d84e59bcabd717df6ee73f1d68a7))
* 431 - Membership portion of reg form ([66d425d](https://github.com/camphoric/camphoric/commit/66d425d40ae66f592af22bbfa68470281d9b3d9c))
* 432 - Add linens to camp harmony ([590bd24](https://github.com/camphoric/camphoric/commit/590bd244d4c85bd5aa29cc3adf11f9d3819a8d66))
* 434 Add text to conf message ([fa8c5c5](https://github.com/camphoric/camphoric/commit/fa8c5c54c31876f1b5183f52f18b27d35664a07a))
* 436 - change memeber to member ([c412937](https://github.com/camphoric/camphoric/commit/c4129370314c2ed444a9233676a8103d8fb37364))
* 437 - Change linen text ([a1feec8](https://github.com/camphoric/camphoric/commit/a1feec83f716d96c1f1f1cf1a2f35d6f8ad163a2))
* 439 - campership given to babies ([f659c00](https://github.com/camphoric/camphoric/commit/f659c00ebe63a2a10acee70724686a6e8c1e42a1))
* 440 - Change text in conf email ([fa6ee56](https://github.com/camphoric/camphoric/commit/fa6ee56df3069bb2faac5379bf23c9fc72414a8a))
* 502 ([119716e](https://github.com/camphoric/camphoric/commit/119716e3f2a0005b3a529cb094a5054227c777a4))
* 503 ([25433ac](https://github.com/camphoric/camphoric/commit/25433ac4552d758c8fbdf37076eaa690070b6443))
* bump minor (not major) for pre-1.0 breaking changes ([6758080](https://github.com/camphoric/camphoric/commit/6758080070a323715cb6bed2f33263c67f2abcc7))
