# Deferred cleanup

From the post-Phase-3 audit. The high-value/low-risk batch was applied (shared
`useEventId`/`useGoToStep` hooks, the `widgetCommon`/`widgetError` helper, shared
test utils + `makeRegisterConfig` fixture, trimmed widget registry, removed dead
`formatDate`, simplified `ConfirmationStep`). Revisit these after the current
build phase:

- **`updating` flag is a no-op** — in `RegistrationStep`, `setUpdating(true)…setUpdating(false)`
  run synchronously around the (synchronous) `calculatePrice`, so the `PriceTicker`
  spinner never shows. Either remove the `updating` plumbing (store + ticker) or move
  pricing off the synchronous path if a recompute indicator is genuinely wanted.
- **Store action-bundle hook** — `RegistrationStep`/`PaymentNeeded` pull many individual
  `useRegistrationStore((s) => s.setX)` selectors. Bundle the (stable) setters in a
  `useRegistrationActions()` hook; keep the value selectors granular.
- **api-types tightening** — type `*_admin_schema` / `*_ui_schema` as `JSONSchema7` / `UiSchema`
  (currently bare `Hash`); consider `ForeignKey = number` instead of `Scalar` for read-only PKs.
- **PayPal capture-error feedback** — `PaymentNeeded.onApprove` catches with `console.error`
  only; surface a notification for parity with the global mutation-error toast. Also: derive
  Card-vs-PayPal from the capture response (currently always reports `'PayPal'`) — needs the
  sandbox to verify.
- **vite/tsconfig `pricing` alias asymmetry** — tsconfig has both `pricing` and `pricing/*`;
  vite has only the dir mapping. Align them.
- **`window.location.search` in the register-config query key** — revisit when invitations
  move into validated router search params.

Intentionally left as-is: `PricingResults` open index signature (load-bearing for dynamic
subtotals), the `Campers` template-injection block (intricate but correct — document, don't
refactor), `setup.ts` jsdom polyfills, and the forward-looking `adminSchema`/`injectDefinitions`
/ `createEntityHooks` key builders / `eventDays` (used by upcoming admin & lodging surfaces).
