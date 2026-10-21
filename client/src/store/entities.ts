/**
 * Concrete CRUD hook sets for every admin entity (SPEC §5). Screens import the
 * hooks they need from here.
 *
 * `alsoInvalidate` encodes the multi-key invalidation the spec calls out:
 * mutating a Camper, Payment, Invoice or CustomCharge changes a Registration's
 * derived totals, so those mutations also invalidate Registration queries.
 *
 * Each hook set's second type parameter names the filters its list takes; keep
 * them in step with the server's (camphoric/views.py, camphoric/filters.py).
 */

import type {
  ApiCamper,
  ApiCustomCharge,
  ApiCustomChargeType,
  ApiDeposit,
  ApiEmailAccount,
  ApiEmailTemplate,
  ApiEmailUnsubscribe,
  ApiEvent,
  ApiInvitation,
  ApiInvoice,
  ApiLodging,
  ApiOrganization,
  ApiPayment,
  ApiPricingOverride,
  ApiPromoCode,
  ApiRegistration,
  ApiRegistrationType,
  ApiReport,
} from 'api-types';

import { createEntityHooks } from './createEntityHooks';

export const organizationHooks = createEntityHooks<ApiOrganization>({ name: 'Organization' });
// The registration form is built from the event's configuration (§7).
export const eventHooks = createEntityHooks<ApiEvent, 'organization'>({
  name: 'Event',
  alsoInvalidate: ['RegisterConfig', 'RegisterConfigAdmin'],
});
export const emailTemplateHooks = createEntityHooks<ApiEmailTemplate, 'event' | 'purpose'>({
  name: 'EmailTemplate',
  path: 'emailtemplates',
});
export const emailUnsubscribeHooks = createEntityHooks<ApiEmailUnsubscribe, 'event'>({
  name: 'EmailUnsubscribe',
  path: 'emailunsubscribes',
  // Who a group email reaches changes with the list.
  alsoInvalidate: ['EmailAudience'],
});
export const emailAccountHooks = createEntityHooks<ApiEmailAccount, 'organization'>({
  name: 'EmailAccount',
  path: 'emailaccounts',
  // The queue status names the event's account and its limits.
  alsoInvalidate: ['EmailQueue'],
});
export const registrationHooks = createEntityHooks<
  ApiRegistration,
  'event' | 'completed' | 'registration_type'
>({ name: 'Registration' });
// Deleting a type drops it from the promo codes that exclude it (§15, DR-107).
export const registrationTypeHooks = createEntityHooks<ApiRegistrationType, 'event'>({
  name: 'RegistrationType',
  alsoInvalidate: ['PromoCode'],
});
export const reportHooks = createEntityHooks<ApiReport, 'event'>({ name: 'Report' });
export const invitationHooks = createEntityHooks<
  ApiInvitation,
  'event' | 'registration' | 'registration_type' | 'registration_type__event'
>({ name: 'Invitation' });
export const lodgingHooks = createEntityHooks<ApiLodging, 'event'>({
  name: 'Lodging',
  // Assignment/scheduling changes which campers appear where.
  alsoInvalidate: ['Camper'],
});
export const camperHooks = createEntityHooks<
  ApiCamper,
  'event' | 'registration' | 'registration__event' | 'registration__completed' | 'lodging'
>({
  name: 'Camper',
  alsoInvalidate: ['Registration'],
});
export const depositHooks = createEntityHooks<ApiDeposit, 'event'>({ name: 'Deposit' });
// A payment changes its invoice's status and the registration's ledger (§9.7).
export const paymentHooks = createEntityHooks<
  ApiPayment,
  'event' | 'registration' | 'registration__event' | 'invoice'
>({
  name: 'Payment',
  alsoInvalidate: ['Registration', 'Invoice'],
});
// An invoice's handling fee is part of what the registration owes (§9.7).
export const invoiceHooks = createEntityHooks<
  ApiInvoice,
  'event' | 'registration' | 'registration__event' | 'registration__completed'
>({
  name: 'Invoice',
  alsoInvalidate: ['Registration', 'Payment'],
});
export const customChargeHooks = createEntityHooks<
  ApiCustomCharge,
  'event' | 'camper' | 'custom_charge_type' | 'custom_charge_type__event'
>({
  name: 'CustomCharge',
  alsoInvalidate: ['Registration', 'Camper'],
});
// Overrides change a line and so the camper's and registration's totals (SPEC DR-56).
export const pricingOverrideHooks = createEntityHooks<
  ApiPricingOverride,
  'event' | 'registration' | 'camper' | 'registration__event'
>({
  name: 'PricingOverride',
  path: 'pricingoverrides',
  alsoInvalidate: ['Registration', 'Camper'],
});
export const customChargeTypeHooks = createEntityHooks<ApiCustomChargeType, 'event'>({
  name: 'CustomChargeType',
});
// Registrations show their code's label, and whether it's been deleted (DR-67).
export const promoCodeHooks = createEntityHooks<ApiPromoCode, 'event'>({
  name: 'PromoCode',
  path: 'promocodes',
  alsoInvalidate: ['Registration'],
});

/**
 * What else each entity's changes change, as its mutations refetch it: live
 * updates (hooks/useEventChangeFeed) refetch the same when someone else makes
 * the change (§9.8; §15, DR-112).
 */
export const ALSO_CHANGES: Record<string, string[]> = Object.fromEntries(
  [
    organizationHooks,
    eventHooks,
    emailTemplateHooks,
    emailUnsubscribeHooks,
    emailAccountHooks,
    registrationHooks,
    registrationTypeHooks,
    reportHooks,
    invitationHooks,
    lodgingHooks,
    camperHooks,
    depositHooks,
    paymentHooks,
    invoiceHooks,
    customChargeHooks,
    pricingOverrideHooks,
    customChargeTypeHooks,
    promoCodeHooks,
  ].map((hooks) => [hooks.name, hooks.alsoInvalidate]),
);
