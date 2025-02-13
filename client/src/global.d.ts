import { JSONSchema7 } from 'json-schema';
import type { PayPalScriptOptions } from "@paypal/paypal-js";
import {
  UiSchema as JsonFormUiSchema,
} from '@rjsf/core';

type JSONLogic = any;
type Template = any;
type Hash<T> = { [key: string]: T };


// TODO: maybe get the backend team to auto-generate these types?

declare global {
  type Scalar = number | string;

  export interface ApiUser {
    id: number;
    date_joined: string;
    email: string;
    first_name: string;
    groups: object[];
    is_active: boolean;
    is_staff: boolean;
    is_superuser: boolean;
    last_login: string;
    last_name: string;
    user_permissions: object[];
    username: string;
  }

  export interface ApiAnonymousUser {
    id: null;
    groups: [];
    is_active: false;
    is_staff: false;
    is_superuser: false;
    last_login: null;
    user_permissions: [];
    username: '';
  }

  export interface ApiEvent {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    name: string;
    registration_start: string | null;
    registration_end: string | null;
    start: string | null;
    end: string | null;
    default_stay_length: number;
    camper_schema: JSONSchema7;
    camper_admin_schema: Object;
    payment_schema: JSONSchema7;
    registration_template_vars: Hash<string>;
    registration_schema: JSONSchema7;
    registration_ui_schema: JSONSchema7;
    registration_admin_schema: Object;
    deposit_schema: JSONSchema7;
    pricing: Hash<number>;
    camper_pricing_logic: JSONLogic;
    registration_pricing_logic: JSONLogic;
    confirmation_page_template: Template;
    confirmation_email_subject: string;
    confirmation_email_template: Template;
    confirmation_email_from: string;
    paypal_enabled: boolean;
    paypal_client_id: string;
    organization: number;
  }

  export interface ApiOrganization {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    name: string;
  }

  export interface ApiReport {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    event: number | string;
    title: string;
    output: string;
    variables_schema: object;
    template: string;
  }

  export interface ApiReportRendered {
    report: string;
    error: string | null;
  }

  export interface ApiRegistration {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    attributes: any;
    admin_attributes: any;
    registrant_email: string;
    server_pricing_results: any;
    client_reported_pricing: any;
    event: number | string;
    registration_type: any;
    payment_type: string;
    paypal_response: object;
    uuid: string;
  }

  export interface ApiCamper {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    attributes: any;
    admin_attributes: any;
    registration: number | string;
    lodging: number | null;
    lodging_requested: number | null;
    lodging_shared: any;
    lodging_shared_with: string;
    lodging_comments: string;
    server_pricing_results: any;
    sequence: number;
    stay: any | null;
  }

  export interface ApiRegistrationType {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    event: number | string;
    invitation_email_subject: string;
    invitation_email_template: string;
    label: string;
    name: string;
  }

  export interface ApiInvitation {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    registration?: string | number;
    registration_type?: number;
    invitation_code: string;
    recipient_name: string;
    recipient_email: string;
    sent_time?: string | number;
    expiration_time?: string | number;
  }

  export type JsonLogicPricing = Array<{
    label?: string;
    var: string;
    exp: any; // JsonLogic
  }>;

  export interface ApiRegister {
    dataSchema: JSONSchema7;
    uiSchema: JsonFormUiSchema;
    preSubmitTemplate: string;
    templateVars: Hash<any>;
    event: Hash<any>;
    pricingLogic: {
      camper: JsonLogicPricing;
      registration: JsonLogicPricing;
    };
    pricing: Hash<any>;
    invitation?: {
      recipient_name: string;
      recipient_email: string;
      invitation_code: string;
    };
    invitationError?: string;
    registrationType?: {
      name: string;
      label: string;
    };
    payPalOptions?: PayPalScriptOptions;
  }

  export interface ApiRegisterPaymentStep {
    registrationUUID: string;
    serverPricingResults: any;
    deposit: JSONSchema7,
  }

  export interface ApiRegisterConfirmationStep {
    confirmationPageTemplate: string;
    serverPricingResults: any;
    initialPayment: any,
  }

  export interface ApiLodging {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    event: number | string;
    parent: number | string;
    name: string;
    children_title: string;
    capacity: number;
    reserved: number;
    visible: boolean;
    sharing_multiplier: number;
    notes: string;
  }

  export interface ApiDeposit {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    event: number | string;
    deposited_on: string | null;
    attributes: any;
    amount: number;
  }

  export interface ApiPayment {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    registration: number | string;
    deposit: number | string | null;
    payment_type: string;
    paid_on: string | null;
    attributes: any;
    amount: number;
  }

  export interface ApiCustomCharge {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    camper: number | string;
    custom_charge_type: number | string;
    amount: number;
    notes: string;
  }

  export interface ApiCustomChargeType {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    event: number | string;
    name: string;
    label: string;
  }
  export interface RouterUrlParams {
    eventId?: string;
    organizationId?: string;
    registrationId?: string;
  }

  export interface AugmentedRegistration extends ApiRegistration {
    campers: Array<ApiCamper>;
    registrationType: ApiRegistrationType | void;
    total_owed: number;
    total_payments: number;
    total_balance: number;
  }

  export interface AugmentedLodging extends ApiLodging {
    children: Array<AugmentedLodging>;
    isLeaf: boolean;
    campers: Array<ApiCamper>;
    count: number;
    fullPath: string;
    maxCapacity: number;
    pathParts: string[];
  }
}

