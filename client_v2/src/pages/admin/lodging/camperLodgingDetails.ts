/**
 * What the lodging screen shows about a camper while placing them (SPEC §8.6):
 * where they are and for which days (and the unit's notes), what they asked
 * for, who they're sharing with, their lodging comments, the registration's type and free-text notes, and
 * the camper's own answers in readable form.
 *
 * The registration's notes are its free-text fields — those its form renders as
 * a textarea (Lark's "Comments") — so no event-specific field name is assumed.
 */

import { getUiOptions, type UiSchema } from '@rjsf/utils';
import type {
  ApiCamper,
  ApiEvent,
  ApiRegistration,
  LodgingLookup,
  RegistrationTypeLookup,
} from 'api-types';
import { injectDefinitions, type ReviewItem, reviewItems } from 'components/form';
import { camperItemUiSchema } from 'pages/admin/campers/camperForm';
import { camperName } from 'utils/camper';

import { lodgingPathLabel } from './timelineUtils';

export interface CamperLodgingDetails {
  camperId: number;
  name: string;
  /** The leaf unit's path ("Camp 1 → Cabin → Cabin 05"), or null when the camper isn't placed. */
  assigned: string | null;
  /** The days they're present, sorted. */
  stay: string[];
  /** The requested node's path, or null when they asked for nothing. */
  requested: string | null;
  shared: boolean;
  sharedWith: string;
  /** The camper's own free-form lodging comments, from the registration form. */
  lodgingComments: string;
  /** The organizers' free-form notes on the unit they're placed in. */
  unitNotes: string;
  /** The registration type's label, or null for none. */
  registrationType: string | null;
  registrationNotes: ReviewItem[];
  attributes: ReviewItem[];
}

type EventSchemas = Pick<
  ApiEvent,
  'camper_schema' | 'registration_schema' | 'registration_ui_schema'
>;

/** The name is the details' heading, so its fields aren't repeated among the answers. */
const NAME_FIELDS = ['first_name', 'last_name'];

function registrationNotes(event: EventSchemas, registration: ApiRegistration): ReviewItem[] {
  const schema = event.registration_schema;
  const uiSchema = event.registration_ui_schema as UiSchema;
  const isFreeText = (key: string) =>
    getUiOptions((uiSchema[key] ?? {}) as UiSchema).widget === 'textarea';
  const others = Object.keys(registration.attributes).filter((key) => !isFreeText(key));
  return reviewItems(schema, uiSchema, registration.attributes, schema, others);
}

function camperAnswers(event: EventSchemas, camper: ApiCamper): ReviewItem[] {
  const schema = injectDefinitions(event.camper_schema, event.registration_schema.definitions);
  const uiSchema = camperItemUiSchema(event.registration_ui_schema);
  return reviewItems(schema, uiSchema, camper.attributes, schema, NAME_FIELDS);
}

export function camperLodgingDetails({
  camper,
  event,
  lodgingLookup,
  registration,
  registrationTypeLookup,
}: {
  camper: ApiCamper;
  event: EventSchemas;
  lodgingLookup: LodgingLookup;
  registration?: ApiRegistration;
  registrationTypeLookup?: RegistrationTypeLookup;
}): CamperLodgingDetails {
  const lodging = camper.lodging == null ? undefined : lodgingLookup[String(camper.lodging)];
  const requested =
    camper.lodging_requested == null ? undefined : lodgingLookup[String(camper.lodging_requested)];
  const registrationType =
    registration?.registration_type == null
      ? undefined
      : registrationTypeLookup?.[String(registration.registration_type)];

  return {
    camperId: camper.id,
    name: camperName(camper),
    assigned: lodging?.isLeaf ? lodgingPathLabel(lodging.pathParts) : null,
    stay: lodging?.isLeaf ? [...(camper.stay ?? [])].sort() : [],
    requested: requested?.pathParts.length ? lodgingPathLabel(requested.pathParts) : null,
    shared: Boolean(camper.lodging_shared),
    sharedWith: camper.lodging_shared_with,
    lodgingComments: camper.lodging_comments,
    unitNotes: lodging?.isLeaf ? lodging.notes : '',
    registrationType: registrationType?.label ?? null,
    registrationNotes: registration ? registrationNotes(event, registration) : [],
    attributes: camperAnswers(event, camper),
  };
}
