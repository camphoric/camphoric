/**
 * Concrete CRUD hook sets for every admin entity (SPEC §5). Screens import the
 * hooks they need from here.
 *
 * `alsoInvalidate` encodes the multi-key invalidation the spec calls out:
 * mutating a Camper, Payment, Invoice or CustomCharge changes a Registration's
 * derived totals, so those mutations also invalidate Registration queries.
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
export const eventHooks = createEntityHooks<ApiEvent>({ name: 'Event' });
export const emailTemplateHooks = createEntityHooks<ApiEmailTemplate>({
  name: 'EmailTemplate',
  path: 'emailtemplates',
});
export const emailUnsubscribeHooks = createEntityHooks<ApiEmailUnsubscribe>({
  name: 'EmailUnsubscribe',
  path: 'emailunsubscribes',
  // Who a group email reaches changes with the list.
  alsoInvalidate: ['EmailAudience'],
});
export const emailAccountHooks = createEntityHooks<ApiEmailAccount>({
  name: 'EmailAccount',
  path: 'emailaccounts',
  // The queue status names the event's account and its limits.
  alsoInvalidate: ['EmailQueue'],
});
export const registrationHooks = createEntityHooks<ApiRegistration>({ name: 'Registration' });
export const registrationTypeHooks = createEntityHooks<ApiRegistrationType>({
  name: 'RegistrationType',
});
export const reportHooks = createEntityHooks<ApiReport>({ name: 'Report' });
export const invitationHooks = createEntityHooks<ApiInvitation>({ name: 'Invitation' });
export const lodgingHooks = createEntityHooks<ApiLodging>({
  name: 'Lodging',
  // Assignment/scheduling changes which campers appear where.
  alsoInvalidate: ['Camper'],
});
export const camperHooks = createEntityHooks<ApiCamper>({
  name: 'Camper',
  alsoInvalidate: ['Registration'],
});
export const depositHooks = createEntityHooks<ApiDeposit>({ name: 'Deposit' });
// A payment changes its invoice's status and the registration's ledger (§9.7).
export const paymentHooks = createEntityHooks<ApiPayment>({
  name: 'Payment',
  alsoInvalidate: ['Registration', 'Invoice'],
});
// An invoice's handling fee is part of what the registration owes (§9.7).
export const invoiceHooks = createEntityHooks<ApiInvoice>({
  name: 'Invoice',
  alsoInvalidate: ['Registration', 'Payment'],
});
export const customChargeHooks = createEntityHooks<ApiCustomCharge>({
  name: 'CustomCharge',
  alsoInvalidate: ['Registration', 'Camper'],
});
// Overrides change a line and so the camper's and registration's totals (SPEC DR-56).
export const pricingOverrideHooks = createEntityHooks<ApiPricingOverride>({
  name: 'PricingOverride',
  path: 'pricingoverrides',
  alsoInvalidate: ['Registration', 'Camper'],
});
export const customChargeTypeHooks = createEntityHooks<ApiCustomChargeType>({
  name: 'CustomChargeType',
});
// Registrations show their code's label, and whether it's been deleted (DR-67).
export const promoCodeHooks = createEntityHooks<ApiPromoCode>({
  name: 'PromoCode',
  path: 'promocodes',
  alsoInvalidate: ['Registration'],
});
