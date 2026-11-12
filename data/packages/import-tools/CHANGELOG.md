# Changelog

## [3.0.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v2.2.0...camphoric-event-import-tools-v3.0.0) (2026-11-12)


### ⚠ BREAKING CHANGES

* **data:** the tools no longer sign in with DJANGO_SUPERUSER_USERNAME/_PASSWORD at /api-token-auth/, and the e2e import no longer sets those variables (use adminCredentials()); CamphoricServer and importForE2E take a token instead of a username and password, and the e2e harness needs a server image with manage.py camphoric_api_token.

### Features

* **data:** match an imported report to the event's by title and update it ([8a17425](https://github.com/camphoric/camphoric/commit/8a174252f97ef57835db994268d3efeb7cef7aeb))
* **data:** sign the import tools in with a personal access token ([bbe52fb](https://github.com/camphoric/camphoric/commit/bbe52fb0df0daf25460a3e5044b921ef31648dbc))
* **reports:** sort reports by title and group them by category ([8a17425](https://github.com/camphoric/camphoric/commit/8a174252f97ef57835db994268d3efeb7cef7aeb)), closes [#992](https://github.com/camphoric/camphoric/issues/992)

## [2.2.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v2.1.0...camphoric-event-import-tools-v2.2.0) (2026-11-06)


### Features

* **data:** add and remove list items and campers in the e2e page object (list, removeCamper) ([57da044](https://github.com/camphoric/camphoric/commit/57da044c1eee79d92a6811572b9b8f012c2b79ef))
* **data:** create invitations in the e2e harness (admin.invite) ([57da044](https://github.com/camphoric/camphoric/commit/57da044c1eee79d92a6811572b9b8f012c2b79ef))
* **data:** raise the e2e server's registration throttles ([57da044](https://github.com/camphoric/camphoric/commit/57da044c1eee79d92a6811572b9b8f012c2b79ef))
* **data:** read the email the e2e server sent (admin.emails) ([57da044](https://github.com/camphoric/camphoric/commit/57da044c1eee79d92a6811572b9b8f012c2b79ef))
* **data:** read the payment step's totals in the e2e page object (paymentTotal) ([57da044](https://github.com/camphoric/camphoric/commit/57da044c1eee79d92a6811572b9b8f012c2b79ef))
* **data:** take online payments in e2e tests through a fake PayPal (onlinePayment, startOnlinePayment, payPal.order) ([57da044](https://github.com/camphoric/camphoric/commit/57da044c1eee79d92a6811572b9b8f012c2b79ef))

## [2.1.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v2.0.0...camphoric-event-import-tools-v2.1.0) (2026-11-06)


### Features

* **data:** import group emails, promo codes and the invoice email ([03e7ab5](https://github.com/camphoric/camphoric/commit/03e7ab51b9ca9d7283f80facddd38ee623c96645)), closes [#970](https://github.com/camphoric/camphoric/issues/970)

## [2.0.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v1.2.1...camphoric-event-import-tools-v2.0.0) (2026-11-05)


### ⚠ BREAKING CHANGES

* **data:** @camphoric/camphoric-event-import-tools requires Node ^22.13.0 || >=23.5.0; Node 20 and Node 22 before 22.13.0 are no longer supported.

### Bug Fixes

* **data:** declare the Node versions the import tools run on ([e506ed3](https://github.com/camphoric/camphoric/commit/e506ed33910181d38b0a46b49e935e841d54e9b8))
* **data:** send the payment step's quote from the import tools ([a804c0a](https://github.com/camphoric/camphoric/commit/a804c0a69570eaf7c6b73d699524354e48306997)), closes [#958](https://github.com/camphoric/camphoric/issues/958)
* **deps:** bump ora from 9.4.1 to 10.0.0 in /data ([453dca8](https://github.com/camphoric/camphoric/commit/453dca8a1798bf6aeb781b00c7d435e3935c98ec))
* **deps:** bump the minor-and-patch group in /data with 11 updates ([7b08ea4](https://github.com/camphoric/camphoric/commit/7b08ea47e53b68bb0f0144539225beb0d3665551))

## [1.2.1](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v1.2.0...camphoric-event-import-tools-v1.2.1) (2026-10-20)


### Bug Fixes

* **data:** keep why the throwaway Camphoric didn't start as the error's cause ([37f8656](https://github.com/camphoric/camphoric/commit/37f865618b8d17c1c724f8474b60fc75cd14b787)), closes [#821](https://github.com/camphoric/camphoric/issues/821)
* **data:** only import into a local server unless CAMPHORIC_ALLOW_REMOTE=1 ([0d86923](https://github.com/camphoric/camphoric/commit/0d86923ca65837433d8bd1c85e61f7e74220e4c6)), closes [#815](https://github.com/camphoric/camphoric/issues/815)
* **data:** retry only GET, PUT and DELETE after a reset connection ([0d86923](https://github.com/camphoric/camphoric/commit/0d86923ca65837433d8bd1c85e61f7e74220e4c6))
* **data:** sign in once per server in the import tools ([470db1e](https://github.com/camphoric/camphoric/commit/470db1e85bae5c8525939dd44caa8c56facd978c)), closes [#800](https://github.com/camphoric/camphoric/issues/800)
* **data:** sign the import tools' registration posts in with their token ([ad10c5a](https://github.com/camphoric/camphoric/commit/ad10c5aed143758df0fd344a728d5c69f967db65)), closes [#801](https://github.com/camphoric/camphoric/issues/801)
* **deps:** bump dotenv in /data in the minor-and-patch group ([8432761](https://github.com/camphoric/camphoric/commit/84327618353ecf915461f4d409ad067aeee62da6))
* **deps:** bump the minor-and-patch group in /data with 8 updates ([28d3e09](https://github.com/camphoric/camphoric/commit/28d3e0972c03cc86e24f0c040c40fe6f428f18fc))

## [1.2.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v1.1.0...camphoric-event-import-tools-v1.2.0) (2026-10-17)


### Features

* **data:** count a camper's lodging levels in the e2e page object ([9f7ac3b](https://github.com/camphoric/camphoric/commit/9f7ac3b06c5647ea1b5796756034eb4694bce01d)), closes [#780](https://github.com/camphoric/camphoric/issues/780)

## [1.1.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-tools-v1.0.0...camphoric-event-import-tools-v1.1.0) (2026-10-17)


### Features

* **data:** add e2e scaffolding for testing an event's registration form ([e98f014](https://github.com/camphoric/camphoric/commit/e98f01486f51fa83773c2840bd32734ed3e61e67))
* **data:** move the event creator and organization loader into import-tools ([c6e8468](https://github.com/camphoric/camphoric/commit/c6e8468a6b2326885a74e24eb036e3c57aa67c1e))


### Bug Fixes

* **data:** keep reset-data-and-test from importing alongside docker compose up ([7543433](https://github.com/camphoric/camphoric/commit/754343397c8cfdb94f473b0ebd98b7262db61534))
* **data:** open an e2e event's registration before its sample registrations ([7543433](https://github.com/camphoric/camphoric/commit/754343397c8cfdb94f473b0ebd98b7262db61534))
* **data:** report an event module's validation errors when it has no event ([c6e8468](https://github.com/camphoric/camphoric/commit/c6e8468a6b2326885a74e24eb036e3c57aa67c1e))
* **data:** stop a failed import request from ending the process ([7543433](https://github.com/camphoric/camphoric/commit/754343397c8cfdb94f473b0ebd98b7262db61534))

## 1.0.0 (2026-10-17)


### Features

* **data:** let each event declare the organization it belongs to ([70853bd](https://github.com/camphoric/camphoric/commit/70853bd5223b0134fd7e259a241c2dc05d22b6c1))
* **data:** publish the event import spec and tools to GitHub Packages ([d26b182](https://github.com/camphoric/camphoric/commit/d26b182d5fe44cc31dbd1747572a267439053574))


### Bug Fixes

* **data:** keep the event-import packages' versions independent ([fd96655](https://github.com/camphoric/camphoric/commit/fd96655bf7b707b7771c964a79781879e2a0c4af))
