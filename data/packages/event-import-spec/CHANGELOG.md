# Changelog

## [1.3.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-spec-v1.2.0...camphoric-event-import-spec-v1.3.0) (2026-11-18)


### Features

* **data:** add an event's cancellation fee to the import spec ([d5423a8](https://github.com/camphoric/camphoric/commit/d5423a82f05367c3bb52f247f1584d948132e559))


### Bug Fixes

* **data:** cap sample registrations at 20 campers, as the server does ([a9353e6](https://github.com/camphoric/camphoric/commit/a9353e60743e324c6592961cdb9d285b5c81925f)), closes [#1013](https://github.com/camphoric/camphoric/issues/1013)
* **data:** hold sample registrations to the server's email rule ([03b58c6](https://github.com/camphoric/camphoric/commit/03b58c679b81b3482168f9c8a5e0feb83a313639)), closes [#1013](https://github.com/camphoric/camphoric/issues/1013)

## [1.2.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-spec-v1.1.0...camphoric-event-import-spec-v1.2.0) (2026-11-12)


### Features

* **api:** let an event define its own payment types, importable with the event ([6b8bfe6](https://github.com/camphoric/camphoric/commit/6b8bfe6bfafbe331f851400ac4dcb81f569fc6fc)), closes [#1002](https://github.com/camphoric/camphoric/issues/1002)
* **client:** offer and label an event's own payment types when recording payments and refunds ([6b8bfe6](https://github.com/camphoric/camphoric/commit/6b8bfe6bfafbe331f851400ac4dcb81f569fc6fc))
* **data:** import an event's payment types, with examples in Sample Camp ([6b8bfe6](https://github.com/camphoric/camphoric/commit/6b8bfe6bfafbe331f851400ac4dcb81f569fc6fc))
* **data:** match an imported report to the event's by title and update it ([8a17425](https://github.com/camphoric/camphoric/commit/8a174252f97ef57835db994268d3efeb7cef7aeb))
* **reports:** sort reports by title and group them by category ([8a17425](https://github.com/camphoric/camphoric/commit/8a174252f97ef57835db994268d3efeb7cef7aeb)), closes [#992](https://github.com/camphoric/camphoric/issues/992)

## [1.1.0](https://github.com/camphoric/camphoric/compare/camphoric-event-import-spec-v1.0.2...camphoric-event-import-spec-v1.1.0) (2026-11-06)


### Features

* **data:** import group emails, promo codes and the invoice email ([03e7ab5](https://github.com/camphoric/camphoric/commit/03e7ab51b9ca9d7283f80facddd38ee623c96645)), closes [#970](https://github.com/camphoric/camphoric/issues/970)

## [1.0.2](https://github.com/camphoric/camphoric/compare/camphoric-event-import-spec-v1.0.1...camphoric-event-import-spec-v1.0.2) (2026-11-05)


### Bug Fixes

* **deps:** bump the minor-and-patch group in /data with 11 updates ([7b08ea4](https://github.com/camphoric/camphoric/commit/7b08ea47e53b68bb0f0144539225beb0d3665551))

## [1.0.1](https://github.com/camphoric/camphoric/compare/camphoric-event-import-spec-v1.0.0...camphoric-event-import-spec-v1.0.1) (2026-10-20)


### Bug Fixes

* **deps:** bump the minor-and-patch group in /data with 8 updates ([28d3e09](https://github.com/camphoric/camphoric/commit/28d3e0972c03cc86e24f0c040c40fe6f428f18fc))

## 1.0.0 (2026-10-17)


### Features

* **data:** let each event declare the organization it belongs to ([70853bd](https://github.com/camphoric/camphoric/commit/70853bd5223b0134fd7e259a241c2dc05d22b6c1))
* **data:** publish the event import spec and tools to GitHub Packages ([d26b182](https://github.com/camphoric/camphoric/commit/d26b182d5fe44cc31dbd1747572a267439053574))


### Bug Fixes

* **data:** keep the event-import packages' versions independent ([fd96655](https://github.com/camphoric/camphoric/commit/fd96655bf7b707b7771c964a79781879e2a0c4af))
