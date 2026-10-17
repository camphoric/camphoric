import type { LodgingLookup, PricingLogicItem } from '@camphoric/camphoric-event-import-spec';

export const ages = {
  adult: 'Adult (18 or older)',
  youth: 'Youth (5-17)',
  child: 'Child (0-4)',
};

// Pricing reads the camper's age with a fallback that is one of its choices
const camperAge = { var: ['camper.age', ages.adult] };

// The lodging a camper chose: its id, among the choices made in the form
const chose = (lodgingIds: LodgingLookup, key: string) => (
  { in: [lodgingIds[key].id, { var: 'camper.lodging.lodging_requested.choices' }] }
);

// The rate for the camper's age, for a kind of lodging
const rateFor = (kind: 'cabin' | 'tent' | 'day') => ({
  if: [
    { '===': [camperAge, ages.youth] }, { var: `pricing.youth_${kind}` },
    { '===': [camperAge, ages.child] }, { var: `pricing.child_${kind}` },
    { var: `pricing.adult_${kind}` },
  ],
});

/**
 * Each camper's charges. They name lodging by its id, which the server only
 * gives once the lodging is saved, so an override sets this logic after the
 * import (index.ts); the event itself is imported with a placeholder.
 */
export default (lodgingIds: LodgingLookup): PricingLogicItem[] => [
  {
    var: 'lodging',
    label: 'Lodging',
    exp: {
      if: [
        chose(lodgingIds, 'cabins'), rateFor('cabin'),
        chose(lodgingIds, 'tents'), rateFor('tent'),
        chose(lodgingIds, 'day'), rateFor('day'),
        0,
      ],
    },
  },
  {
    var: 't_shirt',
    label: 'T-shirt',
    exp: { if: [{ var: ['camper.t_shirt.wanted', false] }, { var: 'pricing.t_shirt' }, 0] },
  },
  {
    var: 'custom_charges',
    label: 'Custom Charges',
    exp: { reduce: [
      { var: 'camper.custom_charges' },
      { '+': [{ var: 'current.amount' }, { var: 'accumulator' }] },
      0,
    ] },
  },
  {
    var: 'total',
    label: 'Total',
    exp: { '+': [{ var: 'lodging' }, { var: 't_shirt' }, { var: 'custom_charges' }] },
  },
];

// What the event is imported with, until the override above replaces it
export const placeholder: PricingLogicItem[] = [
  { var: 'total', label: 'Total', exp: 0 },
];
