/**
 * Typed test fixtures. `makeRegisterConfig` builds a complete `ApiRegister` with
 * sensible defaults so tests don't resort to `as unknown as ApiRegister` casts
 * and the compiler catches shape drift.
 */

import type { ApiRegister } from 'api-types';

export function makeRegisterConfig(overrides: Partial<ApiRegister> = {}): ApiRegister {
  return {
    dataSchema: {},
    uiSchema: {},
    preSubmitTemplate: '',
    templateVars: {},
    event: { is_open: true },
    pricing: {},
    pricingLogic: { registration: [], camper: [] },
    ...overrides,
  };
}
