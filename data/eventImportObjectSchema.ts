/**
 * The contract an event module satisfies: the event import object (written
 * with TypeBox, so one source gives both the `EventImport` type and the JSON
 * Schema that Ajv checks at import time) and the module around it.
 */

import { Ajv, type ErrorObject } from 'ajv';
import ajvFormats from 'ajv-formats';
import Type, { type Static, type TSchema } from 'typebox';

function int(description: string, minimum = 0, otherProps = {}) {
  return Type.Integer({ description, minimum, ...otherProps });
}

function str(description: string, otherProps = {}) {
  return Type.String({ description, maxLength: 50, ...otherProps });
}

// A string with no length limit
function text(description: string) {
  return Type.String({ description });
}

function bool(description: string) {
  return Type.Boolean({ description });
}

function date(description = '') {
  return Type.String({ description, format: 'date-time' });
}

// Any JSON object, such as a JSON Schema, a uiSchema or template data.
function obj(description: string) {
  return Type.Record(Type.String(), Type.Unknown(), { description });
}

function eml(description: string) {
  return Type.String({ description, format: 'email' });
}

const opt = <T extends TSchema>(schema: T) => Type.Optional(schema);

/**
 * One line of pricing logic: `exp` is a JSON Logic expression whose result is
 * stored under `var`, for later lines (and the total) to read.
 */
export const PricingLogicItemSchema = Type.Object({
  var: Type.String({ minLength: 1 }),
  label: opt(Type.String()),
  exp: Type.Unknown(),
});

export type PricingLogicItem = Static<typeof PricingLogicItemSchema>;

function pricingLogic(description: string) {
  return Type.Array(PricingLogicItemSchema, { description });
}

export type RegistrationErrorMessages = Record<string, Record<string, string>>;

const registrationErrorMessages = Type.Unsafe<RegistrationErrorMessages>(Type.Object({}, {
  description: 'Custom validation messages for the registration form: '
    + '{ field path: { validation keyword: Handlebars message } }. '
    + 'Array indexes in the path are written as "*" (e.g. '
    + '"campers.*.lodging.lodging_requested.id"), and the path "*" holds '
    + 'event-wide defaults per keyword.',
  propertyNames: { minLength: 1 },
  additionalProperties: {
    type: 'object',
    propertyNames: { minLength: 1 },
    additionalProperties: { type: 'string', minLength: 1 },
  },
}));

export const LodgingNodeSchema = Type.Object({
  parentKey: opt(str('key of parent, or null')),
  children_title: opt(str('what the form will say when selecting from here')),
  capacity: opt(int('total that is considered "full"')),
  reserved: opt(int('spots held back from registration')),
  sharing_multiplier: opt(Type.Number({ description: 'what a camper sharing lodging takes from its capacity' })),
  visible: opt(bool('whether this shows up on the reg form')),
  name: opt(str('name of this lodging node')),
  notes: opt(str('notes about this lodging node')),
}, {
  additionalProperties: false,
});

/**
 * A lodging node as the importer sees it: once saved, it carries the id the
 * server gave it.
 */
export type LodgingNode = Static<typeof LodgingNodeSchema> & { id?: number };

/**
 * The lodging tree, flattened: every node keyed by a name its children's
 * `parentKey` points at, starting from `root`.
 */
export type Lodgings = { root: LodgingNode } & Record<string, LodgingNode>;

/** Lodging nodes by key, such as pricing logic and sample registrations look ids up in. */
export type LodgingLookup = Record<string, LodgingNode>;

const lodgings = Type.Unsafe<Lodgings>(Type.Object({
  root: Type.Object({
    children_title: opt(str('what the form will say when selecting from here')),
  }),
}, {
  additionalProperties: LodgingNodeSchema,
}));

export const EventImportSchema = Type.Object({
  organization: Type.Union([Type.Number(), Type.String()], {
    description: 'the name or ID for the organization that this should be attached to',
  }),
  event: Type.Object({
    name: str('event name'),
    registration_start: opt(date('when registration opens (an ISO timestamp with an offset)')),
    registration_end: opt(date('when registration closes (an ISO timestamp with an offset)')),
    start: opt(date('when event starts (only its date is kept)')),
    end: opt(date('when event ends (only its date is kept)')),
    time_zone: opt(str('the camp\'s IANA time zone, e.g. America/Los_Angeles (default: the server\'s)')),
    default_stay_length: opt(int('default stay in days')),
    camper_schema: opt(obj('JSON schema for camper')),
    camper_admin_schema: opt(obj('JSON schema for special admin fields')),
    payment_schema: opt(obj('JSON schema for payment')),
    registration_deposit_schema: opt(obj('Data for templates used for registration deposit options')),
    registration_template_vars: opt(obj('Data for templates used during registration')),
    registration_schema: opt(obj('JSON schema for registration')),
    registration_ui_schema: opt(obj('JSON schema for registration UI')),
    registration_error_messages: opt(registrationErrorMessages),
    registration_admin_schema: opt(obj('JSON schema for special admin fields')),
    deposit_schema: opt(obj('JSON schema for extra event deposit attributes')),
    pricing: opt(obj('variables to use in pricing logic')),
    registration_pricing_logic: opt(pricingLogic('JSON logic for registration charges outside of individual campers')),
    camper_pricing_logic: opt(pricingLogic('JSON logic for individual camper')),
    paypal_enabled: opt(bool('whether to enable paypal payments')),
    paypal_client_id: opt(str('paypal api client id', { maxLength: 200 })),
    epayment_handling: opt(str('a percent added to each electronic payment, on the amount paid', { maxLength: 6 })),
    pre_submit_template: opt(text('Handlebars template, rendered right before registration submit button')),
    confirmation_page_template: opt(text('Jinja markdown template, rendered on the server when registration completes')),
    confirmation_email_subject: opt(str('')),
    confirmation_email_template: opt(text('')),
    confirmation_email_from: opt(eml('')),
  }, {
    description: 'an object which has the JSON data to be POSTed to /api/events',
    additionalProperties: false,
  }),
  lodgings: opt(lodgings),
  reports: Type.Array(Type.Object({
    title: str('report title'),
    template: text('Template for report'),
    output: opt(Type.Union(
      [Type.Literal('csv'), Type.Literal('md'), Type.Literal('txt'), Type.Literal('html'), Type.Literal('hbs')],
      { description: 'output format (default csv)' },
    )),
    variables_source: opt(Type.Union(
      [Type.Literal('client'), Type.Literal('server')],
      { description: 'where the template variables come from: client (legacy; what the importer uses by default) or server' },
    )),
  })),
  custom_charge_types: opt(Type.Array(Type.Object({
    name: str('custom charge type name'),
    label: str('custom charge type label'),
  }))),
  registration_types: Type.Array(Type.Object({
    name: str('reg type name'),
    label: str('reg type label'),
    invitation_email_subject: str('subject of reg type invitation email'),
    invitation_email_template: text('Email template of reg type invitation email'),
    registration_schema_overrides: opt(obj('JSON schema for overriding registration schema items')),
  })),
}, {
  additionalProperties: false,
});

export type EventImport = Static<typeof EventImportSchema>;
export type EventData = EventImport['event'];
export type Report = EventImport['reports'][number];
export type RegistrationType = EventImport['registration_types'][number];
export type CustomChargeType = NonNullable<EventImport['custom_charge_types']>[number];

export default EventImportSchema;

// ajv-formats is CommonJS: its plugin is the module's `default` property.
export const addFormats = ajvFormats.default;

/**
 * Check an event import object against the schema: the errors Ajv found, or
 * an empty list when it passes.
 */
export function validateEventImport(data: unknown): ErrorObject[] {
  const ajv = new Ajv({ allowUnionTypes: true });
  addFormats(ajv);

  return ajv.validate(EventImportSchema, data) ? [] : (ajv.errors ?? []);
}

// The rest of the contract: what the importer hands an event module's
// functions, and what they return.

export type FetchMethod = 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';

/** An authenticated request to the Camphoric API, resolving to its JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Fetch = (method: FetchMethod, path: string, data?: unknown) => Promise<any>;

export type Log = (...data: unknown[]) => void;

/** A record the server saved, as it returned it. */
export type Saved = { id: number } & Record<string, unknown>;

/** What the importer has saved so far, for overrides and sample registrations. */
export interface ImportResults {
  event?: Saved;
  lodging?: Lodgings;
  reports?: Saved[];
}

/**
 * What the importer has saved by the time it runs an event's overrides and
 * makes its sample registrations.
 */
export type SavedResults = ImportResults & { event: Saved };

/** The saved lodging tree, for a step that needs the lodging's ids. */
export function savedLodging(results: ImportResults): Lodgings {
  if (!results.lodging) {
    throw new Error('the event\'s lodging has not been imported');
  }

  return results.lodging;
}

/** A sample registration, posted through the public register endpoint. */
export interface SampleRegistration {
  formData: Record<string, unknown>;
  pricingResults: Record<string, unknown>;
  paymentData?: { paymentOption?: string };
}

export type SampleRegGenerator = (
  fetch: Fetch,
  results: SavedResults,
  log: Log,
) => SampleRegistration[] | Promise<SampleRegistration[]>;

/**
 * A step run after the event, its lodging and its registration types are
 * saved, for data that needs their ids (such as pricing that names lodging).
 */
export type Override = (fetch: Fetch, results: SavedResults, log: Log) => Promise<unknown>;

/** What an event module's index exports as its default. */
export interface EventModule {
  data: EventImport;
  sampleRegGenerator?: SampleRegGenerator;
  overrides?: Override[];
}
