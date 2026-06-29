/**
 * Concrete CRUD hook sets for every admin entity (SPEC §5). Screens import the
 * hooks they need from here.
 *
 * `alsoInvalidate` encodes the multi-key invalidation the spec calls out:
 * mutating a Camper, Payment, or CustomCharge changes a Registration's derived
 * totals, so those mutations also invalidate Registration queries.
 */

import type {
  ApiCamper,
  ApiCustomCharge,
  ApiCustomChargeType,
  ApiDeposit,
  ApiEvent,
  ApiInvitation,
  ApiLodging,
  ApiOrganization,
  ApiPayment,
  ApiRegistration,
  ApiRegistrationType,
  ApiReport,
} from 'api-types';

import { createEntityHooks } from './createEntityHooks';

export const organizationHooks = createEntityHooks<ApiOrganization>({ name: 'Organization' });
export const eventHooks = createEntityHooks<ApiEvent>({ name: 'Event' });
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
export const paymentHooks = createEntityHooks<ApiPayment>({
  name: 'Payment',
  alsoInvalidate: ['Registration'],
});
export const customChargeHooks = createEntityHooks<ApiCustomCharge>({
  name: 'CustomCharge',
  alsoInvalidate: ['Registration', 'Camper'],
});
export const customChargeTypeHooks = createEntityHooks<ApiCustomChargeType>({
  name: 'CustomChargeType',
});
