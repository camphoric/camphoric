/**
 * Custom field registry (SPEC §9.1). Fields render a whole property (vs. widgets
 * which render a single input). Events reference these by name in uiSchema, e.g.
 * `ui:field: 'Campers'`.
 */

import type { RegistryFieldsType } from '@rjsf/utils';

import { Address } from './Address';
import { Campers } from './Campers';
import { LodgingRequested } from './LodgingRequested';

export const customFields: RegistryFieldsType = {
  Address,
  Campers,
  LodgingRequested,
};

export { Address, Campers, LodgingRequested };
