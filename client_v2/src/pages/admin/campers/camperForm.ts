/**
 * The camper form in admin mode (SPEC §8.5, §9.5), shared by the camper editor
 * and adding a camper: the event's `camper_schema` given the registration
 * schema's shared `definitions` (so `$ref`s such as an address resolve), and
 * the campers array's item UI schema, admin-transformed.
 */

import type { UiSchema } from '@rjsf/utils';
import type { ApiEvent, Hash } from 'api-types';
import { deriveAdminUiSchema, injectDefinitions } from 'components/form';
import { useMemo } from 'react';

/** The camper UI schema is the campers array's item UI schema (§9.1, §9.5). */
export function camperItemUiSchema(registrationUiSchema: Hash): UiSchema {
  const campers = registrationUiSchema.campers;
  const items = campers && typeof campers === 'object' ? (campers as Hash).items : undefined;
  return (items && typeof items === 'object' ? items : {}) as UiSchema;
}

export function useCamperForm(event: ApiEvent) {
  const schema = useMemo(
    () => injectDefinitions(event.camper_schema, event.registration_schema.definitions),
    [event.camper_schema, event.registration_schema],
  );
  const uiSchema = useMemo(
    () => deriveAdminUiSchema(camperItemUiSchema(event.registration_ui_schema)),
    [event.registration_ui_schema],
  );
  return { schema, uiSchema };
}
