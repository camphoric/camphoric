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

// One of a fixed list of strings: in the JSON Schema, an anyOf of consts
function oneOf<const T extends readonly string[]>(values: T, description: string) {
  return Type.Unsafe<T[number]>(Type.Union(values.map(value => Type.Literal(value)), { description }));
}

// An email's single-line text (a subject, a sender, a reply-to): the server keeps up to 255 characters.
function line(description: string, otherProps = {}) {
  return str(description, { maxLength: 255, ...otherProps });
}

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
  availability: opt(oneOf(
    ['auto', 'full', 'open'],
    'whether registration offers it: auto (by capacity, the default), full (never) or open (even past its capacity)',
  )),
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

/**
 * The operators a group email's recipient rule can use, by the kind of field
 * it reads (server/camphoric/templating/rules.py OPERATORS, which the server
 * checks each rule against when the email is saved).
 */
export const RECIPIENT_RULE_OPERATORS = [
  'contains', 'not_contains', 'is', 'is_not', 'is_set', 'is_not_set',
  'eq', 'ne', 'gt', 'lt', 'gte', 'lte',
  'is_true', 'is_false',
  'any_of',
  'before', 'after', 'on',
] as const;

// The operators that compare with nothing: their rules take no value
export const VALUELESS_RULE_OPERATORS = ['is_set', 'is_not_set', 'is_true', 'is_false'] as const;

const ruleField = Type.String({
  minLength: 1,
  description: 'a dotted path into the variables the expressions see, e.g. registration.balance or camper.attributes.age',
});

// A rule, which (as the server requires) has a value unless its operator takes none
const recipientRule = Type.Union([
  Type.Object({
    field: ruleField,
    op: oneOf(VALUELESS_RULE_OPERATORS, 'how the field is checked'),
    value: opt(Type.Unknown({ description: 'unused' })),
  }, { additionalProperties: false }),
  Type.Object({
    field: ruleField,
    op: oneOf(
      RECIPIENT_RULE_OPERATORS.filter(op => !(VALUELESS_RULE_OPERATORS as readonly string[]).includes(op)),
      'how the field is compared',
    ),
    value: Type.Unknown({
      description: 'what the field is compared with: not empty (null, "" or [])',
      not: { enum: [null, '', []] },
    }),
  }, { additionalProperties: false }),
]);

const recipientRules = Type.Object({
  combinator: opt(oneOf(['and', 'or'], 'whether a recipient must pass every rule (and, the default) or any of them (or)')),
  rules: Type.Array(recipientRule),
}, {
  description: 'the no-code rules choosing recipients: {combinator, rules: [{field, op, value}]}',
  additionalProperties: false,
});

/**
 * A group email (an email template whose purpose is `group`, SPEC §8.9,
 * DR-45): what an admin sends to registrations, campers or listed addresses.
 * Its subject, body and expressions are Jinja. The sending account belongs to
 * the organization, so it's not imported: the event's is used.
 */
export const GroupEmailSchema = Type.Object({
  name: line('the group email\'s name, unique within the event', { minLength: 1 }),
  subject: line('Jinja subject'),
  body: text('Jinja markdown body'),
  from_email: opt(line('the sender (default: the event\'s confirmation_email_from)')),
  reply_to: opt(line('where replies go (default: the sending account\'s)')),
  recipient_source: opt(oneOf(
    ['registrations', 'campers', 'manual'],
    'who it goes to by default: registrations (the default), campers, or the addresses in recipient_list (manual)',
  )),
  filter: opt(recipientRules),
  filter_expression: opt(text('a Jinja expression each recipient must also pass')),
  address_expression: opt(text('a Jinja expression for each recipient\'s address (default: the registrant\'s, or the camper\'s own)')),
  name_expression: opt(text('a Jinja expression for each recipient\'s name')),
  recipient_list: opt(text('for manual: the addresses, one per line, as email or Name <email>')),
  include_incomplete: opt(bool('also choose from registrations that weren\'t completed')),
}, {
  additionalProperties: false,
});

/**
 * A promo code (SPEC DR-67, DR-107): a code a registrant enters for a
 * discount, worked out by its JsonLogic after every other price line.
 */
export const PromoCodeSchema = Type.Object({
  label: line('the name shown on the discount\'s price line', { minLength: 1 }),
  code: Type.String({ minLength: 1, maxLength: 255, pattern: '\\S', description: 'what the registrant enters (case doesn\'t matter)' }),
  pricing_logic: Type.Unknown({ description: 'a JsonLogic expression for the discount: a positive amount' }),
  scope: opt(oneOf(
    ['registration', 'camper'],
    'whether the discount is worked out once for the registration (the default) or for each camper',
  )),
  enabled: opt(bool('whether registrants can use it (default: true)')),
  expiration_date: opt(date('when it stops being usable (an ISO timestamp with an offset)')),
  excluded_registration_types: opt(Type.Array(Type.String({ minLength: 1 }), {
    description: 'the names of the registration types (of this event) whose invited registrants can\'t use it',
  })),
  excludes_uninvited: opt(bool('whether registrants without an invitation can\'t use it')),
}, {
  additionalProperties: false,
});

/**
 * One of the event's own payment types (SPEC §9.7, DR-164): an offline way of
 * being paid, such as Cash or Venmo, that an admin records by hand, offered
 * alongside the built-in Check, Voucher, PayPal and Card. Its value is what a
 * payment stores; no two of the event's may share one, nor may one be a
 * built-in type's (whatever its case).
 */
export const PaymentTypeSchema = Type.Object({
  value: line('what a payment of this type stores, e.g. Venmo', { minLength: 1, pattern: '\\S' }),
  label: line('how the type is shown, e.g. Venmo (@lark-camp)', { minLength: 1, pattern: '\\S' }),
}, {
  additionalProperties: false,
});

/** The built-in payment types: the event's own can't reuse their values. */
export const BUILT_IN_PAYMENT_TYPES = ['Check', 'PayPal', 'Card', 'Voucher'] as const;

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
    payment_types: opt(Type.Array(PaymentTypeSchema, {
      description: 'the event\'s own offline payment types, offered alongside the built-in ones when an admin records a payment',
    })),
    paypal_client_id: opt(str('paypal api client id', { maxLength: 200 })),
    epayment_handling: opt(str('a percent added to each electronic payment, on the amount paid', { maxLength: 6 })),
    pre_submit_template: opt(text('Handlebars template, rendered right before registration submit button')),
    confirmation_page_template: opt(text('Jinja markdown template, rendered on the server when registration completes')),
    confirmation_email_subject: opt(str('')),
    confirmation_email_template: opt(text('')),
    confirmation_email_from: opt(eml('the event\'s sending address: the confirmation email\'s, and the default for its other email')),
    confirmation_email_reply_to: opt(line('where replies to the confirmation email go (default: the sending account\'s)')),
    invoice_email_subject: opt(line('Jinja subject of the email a registrar sends with an invoice')),
    invoice_email_template: opt(text('Jinja markdown body of the email a registrar sends with an invoice')),
    invoice_email_from: opt(line('the invoice email\'s sender (default: confirmation_email_from)')),
    invoice_email_reply_to: opt(line('where replies to the invoice email go (default: the sending account\'s)')),
  }, {
    description: 'an object which has the JSON data to be POSTed to /api/events',
    additionalProperties: false,
  }),
  lodgings: opt(lodgings),
  reports: Type.Array(Type.Object({
    title: str('report title'),
    category: opt(str(
      'groups related reports in the report list, e.g. finance or rooming (default: none)',
      { maxLength: 100 },
    )),
    description: opt(text('what the report shows and who it\'s for')),
    template: text('Template for report'),
    output: opt(Type.Union(
      [Type.Literal('csv'), Type.Literal('md'), Type.Literal('txt'), Type.Literal('html'), Type.Literal('hbs')],
      { description: 'output format (default csv)' },
    )),
    variables_source: opt(Type.Union(
      [Type.Literal('client'), Type.Literal('server')],
      { description: 'where the template variables come from: client (legacy; what the importer uses by default) or server' },
    )),
    variables_schema: opt(obj('JSON schema of the variables a client-variable report reads')),
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
    invitation_email_from: opt(line('the invitation email\'s sender (default: the event\'s confirmation_email_from)')),
    invitation_email_reply_to: opt(line('where replies to the invitation email go (default: the sending account\'s)')),
    camper_schema_overrides: opt(obj('JSON schema merged into the camper schema for registrants invited as this type')),
    registration_schema_overrides: opt(obj('JSON schema for overriding registration schema items')),
    ui_schema_overrides: opt(obj('uiSchema merged into the registration form\'s uiSchema for registrants invited as this type')),
  })),
  email_templates: opt(Type.Array(GroupEmailSchema, {
    description: 'the event\'s group emails (SPEC §8.9), matched to the saved ones by name',
  })),
  promo_codes: opt(Type.Array(PromoCodeSchema, {
    description: 'codes a registrant can enter for a discount, matched to the saved ones by code (ignoring case)',
  })),
}, {
  additionalProperties: false,
});

export type EventImport = Static<typeof EventImportSchema>;
export type EventData = EventImport['event'];
export type Report = EventImport['reports'][number];
export type RegistrationType = EventImport['registration_types'][number];
export type CustomChargeType = NonNullable<EventImport['custom_charge_types']>[number];
export type GroupEmail = Static<typeof GroupEmailSchema>;
export type PromoCode = Static<typeof PromoCodeSchema>;
export type PaymentType = Static<typeof PaymentTypeSchema>;

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
  registration_types?: Saved[];
  // the group emails
  email_templates?: Saved[];
  promo_codes?: Saved[];
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

/**
 * The organization an event belongs to, with the email account it sends from.
 * The importer creates it (and its account) when the server has none by that
 * name.
 */
export interface OrganizationImport {
  organization: { name: string };
  emailAccount: {
    name?: string,
    backend?: string,
    host?: string,
    port?: string,
    username?: string,
    password?: string,
  };
}

/** What an event module's index exports as its default. */
export interface EventModule {
  data: EventImport;
  // data.organization names this organization
  organization: OrganizationImport;
  sampleRegGenerator?: SampleRegGenerator;
  overrides?: Override[];
}

/** An event module, as importing its package (or its index.ts) gives it. */
export interface LoadedEventModule {
  default: EventModule;
  // the event's name, as data.event.name has it
  eventName?: string;
}
