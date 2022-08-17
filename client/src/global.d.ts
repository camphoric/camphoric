import { JSONSchema7 } from "json-schema";
import {
  UiSchema as JsonFormUiSchema,
} from '@rjsf/core';

type JSONLogic = any;
type Template = any;

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
    camper_schema: JSONSchema7;
    payment_schema: JSONSchema7;
    registration_schema: JSONSchema7;
    registration_ui_schema: JSONSchema7;
    deposit_schema: JSONSchema7;
    pricing: {
      [id: string]: number;
    };
    camper_pricing_logic: JSONLogic;
    registration_pricing_logic: JSONLogic;
    confirmation_page_template: Template;
    confirmation_email_subject: string;
    confirmation_email_template: Template;
    confirmation_email_from: string;
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
    template: string;
  }

  export interface ApiRegistration {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    attributes: any;
    registrant_email: string;
    server_pricing_results: any;
    client_reported_pricing: any;
    event: number | string;
    registration_type: any;
  }

  export interface ApiCamper {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    attributes: any;
    registration: number | string;
    lodging: any;
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
    registration_type?: string;
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
    event: { [key: string]: any };
    pricingLogic: {
      camper: JsonLogicPricing;
      registration: JsonLogicPricing;
    };
    pricing: { [key: string]: any };
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
    payPalOptions?: { 'client-id': string };
  }

  export interface ApiLodging {
    id: number;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    event: number | string;
    parent: number | string;
    name: string | null;
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

  export interface RouterUrlParams {
    eventId?: string;
    organizationId?: string;
    registrationId?: string;
  }

  export interface AugmentedRegistration extends ApiRegistration {
    campers: Array<ApiCamper>;
  }
}

