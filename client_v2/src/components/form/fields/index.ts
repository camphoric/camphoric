/**
 * Custom field registry (SPEC §9.1). Fields render a whole property (vs. widgets
 * which render a single input). Events reference these by name in uiSchema, e.g.
 * `ui:field: 'Campers'`. `BooleanField` overrides rjsf's own so labeled
 * booleans render as dropdowns.
 */

import type { RegistryFieldsType } from '@rjsf/utils';

import { Address } from './Address';
import { BooleanField } from './BooleanField';
import { Campers } from './Campers';
import { LodgingRequested } from './LodgingRequested';

export const customFields: RegistryFieldsType = {
  Address,
  BooleanField,
  Campers,
  LodgingRequested,
};

export { Address, BooleanField, Campers, LodgingRequested };
