import type { PromoCode } from '@camphoric/camphoric-event-import-spec';

import { dates } from './dates.ts';

// Promo codes (SPEC DR-67): each one's JsonLogic works out a discount, after
// every other price line, for the registration or for each camper.
export default [
  {
    label: 'Early bird',
    code: 'EARLYBIRD',
    // 10% off the registration's total
    pricing_logic: { '*': [{ var: 'total' }, 0.1] },
    scope: 'registration',
    enabled: true,
    expiration_date: dates.start.minus({ months: 3 }).toISO()!,
  },
  {
    label: 'Free T-shirt',
    code: 'shirt-on-us',
    // each camper's T-shirt, if they ordered one
    pricing_logic: { if: [{ var: 'camper.t_shirt.wanted' }, { var: 'pricing.t_shirt' }, 0] },
    scope: 'camper',
    // only for late registrants: not staff, and not anyone uninvited
    excluded_registration_types: ['staff'],
    excludes_uninvited: true,
  },
] satisfies PromoCode[];
