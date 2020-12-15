import { JSONSchema7 } from "json-schema";

type JSONLogic = any;
type Template = any;

// TODO: maybe get the backend team to auto-generate these types?

declare global {
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

  export interface RouterUrlParams {
    eventId?: string;
    organizationId?: string;
  }
}

