import type { ApiPaymentOptions } from 'api-types';

/** Lark's choices: pay in full, or a 50% deposit of tuition and meals. */
export const DEPOSIT_OPTIONS: ApiPaymentOptions = {
  title: 'Full Payment or Deposit Only',
  description: 'Pay in full, or a **50% deposit** with the balance due by June 20.',
  default: 'Full Payment',
  options: [
    { name: 'Full Payment', title: 'Full Payment', amount: 1000, handling: 25 },
    { name: '50% Deposit', title: '50% Deposit', amount: 550, handling: 13.75 },
  ],
};

export const SINGLE_OPTION: ApiPaymentOptions = {
  title: '',
  description: '',
  default: 'Full payment',
  options: [{ name: 'Full payment', title: 'Full payment', amount: 400, handling: 10 }],
};

export const NO_FEE: ApiPaymentOptions = {
  ...SINGLE_OPTION,
  options: [{ name: 'Full payment', title: 'Full payment', amount: 400, handling: 0 }],
};
