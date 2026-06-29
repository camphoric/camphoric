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
  payment_schema: JSONSchema7;
  deposit_schema: JSONSchema7;

  // Pricing.
  pricing: Hash<number>;
  camper_pricing_logic: JsonLogicPricing;
  registration_pricing_logic: JsonLogicPricing;
  registration_template_vars: Hash<string>;

  // Confirmation page + email.
  confirmation_page_template: string;
  confirmation_email_subject: string;
  confirmation_email_template: string;
  confirmation_email_from: string;

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
  invitation_email_subject: string;
  invitation_email_template: string;
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
  attributes: Hash;
  amount: number;
  notes: string;
}

export interface ApiCustomCharge extends TimeStamped {
  id: number;
  camper: Scalar;
  custom_charge_type: Scalar;
  amount: number;
  notes: string;
}

export interface ApiCustomChargeType extends TimeStamped {
  id: number;
  event: Scalar;
  name: string;
  label: string;
}

export type ReportOutputType = 'csv' | 'md' | 'txt' | 'hbs';

export interface ApiReport extends TimeStamped {
  id: number;
  event: Scalar;
  title: string;
  output: ReportOutputType;
  template: string;
  variables_schema: Hash;
}

export interface ApiRenderedReport {
  report: string;
  error: string | null;
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

/** The config bundle returned by GET /api/events/{id}/register. */
export interface ApiRegister {
  dataSchema: JSONSchema7;
  uiSchema: Hash;
  preSubmitTemplate: string;
  epayment_handling?: number;
  templateVars: Hash;
  event: ApiEvent;
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
  confirmationPageTemplate: string;
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
