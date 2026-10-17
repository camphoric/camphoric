import type { PricingLogicItem } from '@camphoric/camphoric-event-import-spec';

// Charges for the registration as a whole, beside each camper's
export default [
  {
    var: 'donation',
    label: 'Scholarship Fund Donation',
    exp: { var: ['registration.donation', 0] },
  },
  {
    var: 'total',
    label: 'Total',
    exp: { '+': [{ var: 'donation' }] },
  },
] satisfies PricingLogicItem[];
