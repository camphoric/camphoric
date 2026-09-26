/**
 * Explicit, exported API entity types (SPEC §5, DR-27).
 *
 * These are a hand-maintained contract that MUST stay in sync with the Django
 * serializers (server/camphoric/serializers.py). They are intentionally NOT
 * `declare global` ambient types — callers import them so the source of each
 * type is discoverable. A future pass replaces this with types generated from a
 * backend OpenAPI schema (see TODO.md / DR-27).
 *
 * JSON columns (schemas, attributes, pricing logic) are typed loosely as the
 * data is server-defined and validated server-side.
 */

import type { JSONSchema7 } from 'json-schema';

export type Scalar = string | number;
export type Json = unknown;
export type Hash<T = unknown> = Record<string, T>;

/** A JSON Logic expression (evaluated by json-logic-js for live pricing). */
export type JsonLogicExpression = Json;

/** One pricing component: a named variable and the expression that computes it. */
export interface JsonLogicPricingComponent {
  label?: string;
  var: string;
  exp: JsonLogicExpression;
}
export type JsonLogicPricing = JsonLogicPricingComponent[];

/** Fields shared by all TimeStampedModel-backed entities. */
export interface TimeStamped {
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ---------------------------------------------------------------------------
// Core CRUD entities
// ---------------------------------------------------------------------------

export interface ApiOrganization extends TimeStamped {
  id: number;
  name: string;
}

/**
 * Per-event validation messages for the registration form (SPEC §7.1, DR-34):
 * field path (array indexes written as `*`, `*` alone = every field) →
 * validation keyword (e.g. `required`, `pattern`) → Handlebars message.
 */
export type RegistrationErrorMessages = Record<string, Record<string, string>>;

export interface ApiEvent extends TimeStamped {
  id: number;
  name: string;
  organization: number;

  // Event + registration windows (ISO dates / datetimes).
  start: string;
  end: string;
  registration_start: string;
  registration_end: string;
  default_stay_length: number;

  // Data-driven schemas.
  camper_schema: JSONSchema7;
  camper_admin_schema: Hash;
  registration_schema: JSONSchema7;
  registration_ui_schema: Hash;
  registration_admin_schema: Hash;
  registration_error_messages: RegistrationErrorMessages;
  payment_schema: JSONSchema7;
  deposit_schema: JSONSchema7;

  // Pricing.
  pricing: Hash<number>;
  camper_pricing_logic: JsonLogicPricing;
  registration_pricing_logic: JsonLogicPricing;
  registration_template_vars: Hash<string>;

  // Confirmation page + email.
  confirmation_page_template: string;
  /** The confirmation email's template (created with the event; read-only here). */
  confirmation_template: number | null;
  /** The event's sending address (the confirmation's, and its email's default). */
  confirmation_email_from: string;
  /** The event's sending account (null: the server's default mailer). */
  email_account: number | null;

  // Payments.
  paypal_enabled: boolean;
  paypal_client_id: string;
  epayment_handling: number;
}

export interface ApiRegistration extends TimeStamped {
  id: number;
  attributes: Hash;
  admin_attributes: Hash;
  registrant_email: string;
  server_pricing_results: PricingResults;
  client_reported_pricing: PricingResults;
  event: Scalar;
  registration_type?: Scalar | null;
  payment_type: string;
  paypal_response: Hash;
  uuid: string;
}

export interface ApiCamper extends TimeStamped {
  id: number;
  attributes: Hash;
  admin_attributes: Hash;
  registration: Scalar;
  lodging?: Scalar | null;
  lodging_requested?: Scalar | null;
  lodging_shared?: boolean | null;
  lodging_shared_with: string;
  lodging_comments: string;
  server_pricing_results: PricingResults;
  sequence: number;
  /** ISO YYYY-MM-DD strings for each day the camper is present. */
  stay?: string[] | null;
}

export interface ApiRegistrationType extends TimeStamped {
  id: number;
  event: Scalar;
  name: string;
  label: string;
  /** The invitation email's template (created with the type; read-only here). */
  invitation_template: number | null;
}

export interface ApiInvitation extends TimeStamped {
  id: number;
  registration?: Scalar | null;
  registration_type?: Scalar | null;
  invitation_code: string;
  recipient_name: string;
  recipient_email: string;
  sent_time?: string | null;
  expiration_time?: string | null;
  /** The latest invitation email's delivery (read-only; null: never sent). */
  email?: {
    id: number;
    status: EmailMessageStatus;
    error: string;
    queued_at: string;
    sent_at: string | null;
  } | null;
}

export interface ApiLodging extends TimeStamped {
  id: number;
  event: Scalar;
  parent?: Scalar | null;
  name: string;
  children_title: string;
  capacity: number;
  reserved: number;
  visible: boolean;
  sharing_multiplier: number;
  notes: string;
}

export interface ApiDeposit extends TimeStamped {
  id: number;
  event: Scalar;
  deposited_on?: string | null;
  attributes: Hash;
  amount: number;
}

export type PaymentType = 'Check' | 'PayPal' | 'Card' | 'Voucher';

export interface ApiPayment extends TimeStamped {
  id: number;
  registration: Scalar;
  deposit?: Scalar | null;
  payment_type: PaymentType;
  paid_on?: string | null;
  attributes: Hash | null;
  // DRF `DecimalField` serializes to a string on read (e.g. `"675.00"`); writes
  // accept a number. Coerce with `Number(...)` / format with `formatMoney`.
  amount: number | string;
  notes: string;
}

export interface ApiCustomCharge extends TimeStamped {
  id: number;
  camper: Scalar;
  custom_charge_type: Scalar;
  // See `ApiPayment.amount` — a string on read, number on write.
  amount: number | string;
  notes: string;
}

export interface ApiCustomChargeType extends TimeStamped {
  id: number;
  event: Scalar;
  name: string;
  label: string;
}

/** A public event-list entry (GET /api/eventlist) for the splash (§4). */
export interface ApiEventListItem {
  name: string;
  /** Front-end registration route, e.g. `/events/12/register`. */
  url: string;
  open: boolean;
  /** Registration open/close dates (ISO `YYYY-MM-DD`), or null if unbounded. */
  registration_start?: string | null;
  registration_end?: string | null;
}

export type ReportOutputType = 'csv' | 'md' | 'txt' | 'html' | 'hbs';

/**
 * Where a report's variables come from (§8.7): `client` posts the bundle the
 * browser builds (legacy); `server` renders from the server's variable graph
 * and posts nothing.
 */
export type ReportVariablesSource = 'client' | 'server';

export interface ApiReport extends TimeStamped {
  id: number;
  event: Scalar;
  title: string;
  output: ReportOutputType;
  template: string;
  variables_schema: Hash;
  variables_source: ReportVariablesSource;
}

export interface ApiRenderedReport {
  report: string;
  error: string | null;
  /** Server-source reports only: every problem, with template lines. */
  diagnostics?: TemplateDiagnostic[];
}

// --- Server-rendered Jinja templates (§5, §9.6) ---------------------------

/** A problem found rendering a template; `line`/`column` are 1-based. */
export interface TemplateDiagnostic {
  severity: 'error' | 'warning';
  kind: 'syntax' | 'undefined' | 'security' | 'timeout' | 'output_limit' | 'runtime';
  message: string;
  /** Which text the problem is in: `template` or `subject`. */
  field: string;
  line: number | null;
  column: number | null;
}

/** The kinds of template, each with its own root variables. */
export type TemplateContextName =
  | 'report'
  | 'confirmation_email'
  | 'confirmation_page'
  | 'invitation_email'
  | 'bulk_email_registration'
  | 'bulk_email_camper'
  | 'bulk_email_manual';

/**
 * One variable or field. `type` is `string`, `number`, `bool`, `money`,
 * `date`, `datetime`, `dict`, `any`, `list<T>`, or the name of a type in
 * `TemplateDescription.types`.
 */
export interface TemplateFieldDescription {
  name: string;
  type: string;
  doc: string;
  example?: string;
  nullable?: boolean;
  /** A method or function: inserted with parentheses. */
  callable?: boolean;
  signature?: string;
  /** Event form questions: the question's title. */
  title?: string;
  /** False when the key must be written `['key']`. Absent means true. */
  identifier?: boolean;
  enum?: unknown[];
  format?: string;
}

export interface TemplateTypeDescription {
  doc: string;
  fields: TemplateFieldDescription[];
}

export interface TemplateContextDescription {
  title: string;
  doc: string;
  roots: TemplateFieldDescription[];
  /** The kind of record a preview renders for, if any. */
  sample: 'registration' | 'camper' | 'invitation' | null;
}

export interface TemplateFilterDescription {
  name: string;
  signature: string;
  doc: string;
  example: string;
  /** A standard Jinja filter rather than one Camphoric adds. */
  builtin: boolean;
}

export interface TemplateTestDescription {
  name: string;
  doc: string;
  example: string;
}

export interface TemplateTagDescription {
  name: string;
  doc: string;
  /** Monaco snippet syntax, including the `{% %}`. */
  snippet: string;
}

/** GET /api/events/<id>/templates/describe — the variable spec (DR-36). */
export interface TemplateDescription {
  contexts: Record<TemplateContextName, TemplateContextDescription>;
  types: Record<string, TemplateTypeDescription>;
  filters: TemplateFilterDescription[];
  tests: TemplateTestDescription[];
  tags: TemplateTagDescription[];
  globals: TemplateFieldDescription[];
}

export type TemplatePreviewOutput = 'csv' | 'md' | 'txt' | 'html' | 'email';

/** POST /api/events/<id>/templates/preview — renders unsaved text. */
export interface TemplatePreviewRequest {
  context: TemplateContextName;
  template: string;
  output: TemplatePreviewOutput;
  subject?: string;
  registration_id?: number;
  camper_id?: number;
  invitation_id?: number;
  registration_type_id?: number;
}

export interface TemplatePreviewResponse {
  output: string;
  subject?: string;
  /** `email` output: the body rendered from markdown to HTML. */
  html?: string;
  diagnostics: TemplateDiagnostic[];
  truncated: boolean;
  duration_ms: number;
  sample: { kind: string; id: number; label: string } | null;
}

/** GET /api/events/<id>/templates/check — every saved template of an event. */
export interface TemplateCheckResponse {
  ok: boolean;
  results: {
    kind: string;
    id: number;
    label: string;
    mode: 'rendered' | 'parsed' | 'skipped';
    diagnostics: TemplateDiagnostic[];
  }[];
}

export interface ApiUser {
  id: number | null;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
}

/** The anonymous (logged-out) user — username is empty and id is null. */
export const anonymousUser: ApiUser = {
  id: null,
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  is_staff: false,
  is_superuser: false,
  is_active: false,
};

// ---------------------------------------------------------------------------
// Pricing (mirrors the server's calculate_price output; SPEC §9.2)
// ---------------------------------------------------------------------------

/**
 * Open result object: `total`, named subtotals, a per-camper breakdown, and an
 * optional electronic-payment handling fee. Whole-dollar amounts by convention.
 */
export interface PricingResults {
  total: number;
  campers: Hash[];
  handling?: number;
  [namedSubtotal: string]: number | Hash[] | undefined;
}

// ---------------------------------------------------------------------------
// Registration / payment bundle (the bespoke /api/events/{id}/register endpoint)
// ---------------------------------------------------------------------------

/** Form data the registrant edits; `campers` is always present. */
export interface RegistrationFormData {
  campers: Hash[];
  [field: string]: unknown;
}

/** A date as the register endpoint serializes it (a dict, not an ISO string). */
export interface DateDict {
  epoch: number;
  year: number;
  month: number;
  day: number;
}

/**
 * The `event` subset embedded in the register config (server
 * `pricing.get_event_attributes`). Dates are dicts and `is_open` drives the
 * registration-closed check — this is NOT the full {@link ApiEvent}.
 */
export interface RegisterConfigEvent {
  is_open: boolean;
  epayment_handling?: number;
  registration_start?: DateDict;
  registration_end?: DateDict;
  start?: DateDict;
  end?: DateDict;
}

/** The config bundle returned by GET /api/events/{id}/register. */
export interface ApiRegister {
  dataSchema: JSONSchema7;
  uiSchema: Hash;
  preSubmitTemplate: string;
  templateVars: Hash;
  /** The event's custom validation messages; absent from older servers. */
  registrationErrorMessages?: RegistrationErrorMessages;
  event: RegisterConfigEvent;
  pricingLogic: {
    registration: JsonLogicPricing;
    camper: JsonLogicPricing;
  };
  pricing: Hash<number>;
  invitation?: {
    recipient_name: string;
    recipient_email: string;
    invitation_code: string;
  };
  invitationError?: string;
  registrationType?: { name: string; label: string };
  payPalOptions?: Hash;
}

export interface ApiRegisterPaymentStep {
  registrationUUID: string;
  serverPricingResults: PricingResults;
  /** Optional deposit-options schema; present when the event offers deposits. */
  deposit?: JSONSchema7;
}

export interface ApiRegisterConfirmationStep {
  /** The event's confirmation page, rendered on the server (markdown; §7.3). */
  confirmationPage: string;
  /** Whether the confirmation email couldn't be sent. */
  emailError?: boolean;
  serverPricingResults: PricingResults;
  initialPayment: Hash;
}

/** The deposit choice name embedded in / recovered from PayPal's custom_id. */
export type DepositType = string;

export interface InitialPaymentBody {
  registrationUUID: string;
  paymentType: PaymentType;
  paymentData: {
    type: DepositType;
    total: number;
  };
  payPalResponse?: Hash;
}

// ---------------------------------------------------------------------------
// Augmented view models — domain logic derived from cached query data (SPEC §5)
// ---------------------------------------------------------------------------

export interface AugmentedRegistration extends ApiRegistration {
  campers: ApiCamper[];
  registrationType?: ApiRegistrationType;
  total_owed: number;
  total_payments: number;
  total_balance: number;
}

export interface AugmentedLodging extends ApiLodging {
  children: AugmentedLodging[];
  isLeaf: boolean;
  campers: ApiCamper[];
  count: number;
  /** Explicit capacity, or the summed capacity of children when 0. */
  capacity: number;
  maxCapacity: number;
  /** e.g. "Building A→Room 101". */
  fullPath: string;
  pathParts: string[];
}

// Lookups keyed by stringified id, derived alongside the augmented view models.
export type RegistrationLookup = Record<string, AugmentedRegistration>;
export type CamperLookup = Record<string, ApiCamper>;
export type LodgingLookup = Record<string, AugmentedLodging>;
export type RegistrationTypeLookup = Record<string, ApiRegistrationType>;

/**
 * The variable bundle handed to a report template — POSTed to the render
 * endpoint for server-rendered formats and passed to the Handlebars engine for
 * client-rendered ones (SPEC §8.7, §9.4).
 */
export interface ReportTemplateVars {
  event: ApiEvent;
  registrations: AugmentedRegistration[];
  registrationLookup: RegistrationLookup;
  campers: ApiCamper[];
  camperLookup: CamperLookup;
  lodgingLookup: LodgingLookup;
  registrationTypeLookup: RegistrationTypeLookup;
}

// --- Email outbox and accounts (SPEC §5, §8.9; §15 DR-44) ----------------------

export type EmailMessageKind =
  'confirmation' | 'confirmation_report' | 'page_report' | 'invitation' | 'bulk' | 'test';

export type EmailMessageStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';

/** A page of a DRF paginated list. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** One queued or sent email; the list leaves out `text` and `html`. */
export interface ApiEmailMessage extends TimeStamped {
  id: number;
  event: number | null;
  kind: EmailMessageKind;
  registration: number | null;
  invitation: number | null;
  account: number | null;
  account_name: string | null;
  from_email: string;
  to: string;
  reply_to: string;
  subject: string;
  text?: string;
  html?: string;
  status: EmailMessageStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string;
  sent_at: string | null;
  smtp_message_id: string;
  created_by: number | null;
  created_by_name: string | null;
}

/** What an event's email is doing now (GET /api/events/{id}/email/queue). */
export interface EmailQueueState {
  queued: number;
  sending: number;
  failed_last_day: number;
  next_attempt_at: string | null;
  worker: { required: boolean; alive: boolean; last_seen: string | null };
  account: {
    id: number;
    name: string;
    max_per_minute: number | null;
    max_per_day: number | null;
    sent_last_minute: number;
    sent_last_day: number;
    /** Set while a sending limit is used up: the account's mail waits until then. */
    paused_until: string | null;
  } | null;
}

export type EmailAccountSecurity = 'starttls' | 'ssl' | 'none';

export interface ApiEmailAccount extends TimeStamped {
  id: number;
  organization: number;
  name: string;
  backend: string;
  host: string;
  port: number;
  security: EmailAccountSecurity;
  timeout: number;
  username: string;
  /** Write-only: never returned; blank on an update keeps the stored one. */
  password?: string;
  password_status: 'set' | 'unset' | 'unreadable';
  max_per_minute: number | null;
  max_per_day: number | null;
  default_reply_to: string;
}

export type EmailTemplatePurpose = 'confirmation' | 'invitation' | 'group';

/** An email the event sends, in Jinja markdown (SPEC §5; §15 DR-45). */
export interface ApiEmailTemplate extends TimeStamped {
  id: number;
  event: number;
  purpose: EmailTemplatePurpose;
  name: string;
  subject: string;
  body: string;
  /** Blank: the event's confirmation_email_from. */
  from_email: string;
  /** Blank: the sending account's default. */
  reply_to: string;
  /** Null: the event's account. */
  account: number | null;
  // A group email's default audience (§8.9).
  recipient_source: EmailRecipientSource;
  filter: EmailFilter;
  filter_expression: string;
  address_expression: string;
  name_expression: string;
  recipient_list: string;
  include_incomplete: boolean;
}

// --- Group email (SPEC §5, §8.9; §15 DR-45) -----------------------------------

export type EmailRecipientSource = 'registrations' | 'campers' | 'manual';

export type EmailFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'date' | 'list';

export type EmailRuleOp =
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'is_set'
  | 'is_not_set'
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is_true'
  | 'is_false'
  | 'any_of'
  | 'before'
  | 'after'
  | 'on';

export type EmailRuleValue = string | number | string[] | null;

export interface EmailRule {
  field: string;
  op: EmailRuleOp;
  value?: EmailRuleValue;
}

export interface EmailFilter {
  combinator?: 'and' | 'or';
  rules?: EmailRule[];
}

/** A field recipients can be chosen by (GET …/email/recipient-fields). */
export interface EmailRecipientField {
  key: string;
  label: string;
  group: string;
  type: EmailFieldType;
  options?: { value: string | number; label: string }[];
}

/** The audience fields a recipients preview or test send takes. */
export interface EmailAudience {
  recipient_source: EmailRecipientSource;
  filter: EmailFilter;
  filter_expression: string;
  address_expression: string;
  name_expression: string;
  recipient_list: string;
  include_incomplete: boolean;
}

export interface AudienceRecipient {
  key: string;
  email: string;
  name: string;
  label: string;
  registration: number | null;
  camper: number | null;
  already_sent: boolean;
}

export interface AudienceSkipped {
  label: string;
  reason: 'no_address' | 'invalid' | 'duplicate' | 'filter_error' | 'unsubscribed';
  detail: string;
  email: string;
  registration: number | null;
  camper: number | null;
}

/** An address unsubscribed from an event's group email (SPEC §5; §15 DR-48). */
export interface ApiEmailUnsubscribe {
  id: number;
  event: number;
  /** Lowercased. */
  email: string;
  /** `link`: the recipient followed an email's unsubscribe link; `admin`: an organizer added it. */
  source: 'link' | 'admin';
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface AudienceResolution {
  recipients: AudienceRecipient[];
  skipped: AudienceSkipped[];
  diagnostics: TemplateDiagnostic[];
}

export type EmailBatchState = 'scheduled' | 'preparing' | 'sending' | 'done' | 'cancelled';

/** One send of a group email (SPEC §5). */
export interface ApiEmailBatch extends TimeStamped {
  id: number;
  event: number;
  template: number | null;
  name: string;
  subject: string;
  body: string;
  recipient_source: EmailRecipientSource;
  recipient_keys: string[];
  account: number | null;
  from_email: string;
  reply_to: string;
  skip_already_sent: boolean;
  send_at: string | null;
  status: 'scheduled' | 'expanding' | 'sending' | 'cancelled';
  skipped: { key: string; label: string; reason: string }[];
  error: string;
  created_by: number | null;
  created_by_name: string | null;
  total: number;
  sent: number;
  failed: number;
  cancelled: number;
  waiting: number;
  state: EmailBatchState;
}

export interface EmailSendRequest {
  recipient_keys: string[];
  account?: number | null;
  from_email?: string;
  reply_to?: string;
  skip_already_sent?: boolean;
  send_at?: string | null;
}

export interface EmailTemplateTestRequest extends Partial<EmailAudience> {
  to?: string;
  recipient_key?: string;
  subject?: string;
  body?: string;
}

export interface EmailTemplateTestResponse {
  message: ApiEmailMessage;
  rendered_for: AudienceRecipient;
  diagnostics: TemplateDiagnostic[];
}
