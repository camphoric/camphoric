# Changelog

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
