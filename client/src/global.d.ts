import { JSONSchema6 } from "json-schema";

type JSONLogic = any;
type Template = any;

// TODO: maybe get the backend team to auto-generate these types?

declare global {
  export interface ApiEvent {
    id: number,
    created_at: string | null,
    updated_at: string | null,
    deleted_at: string | null,
    name: string,
    registration_start: null,
    registration_end: null,
    start: string | null,
    end: string | null,
    camper_schema: JSONSchema6,
    payment_schema: JSONSchema6,
    registration_schema: { },
    registration_ui_schema: { },
    deposit_schema: null,
    pricing: {
      [id: string]: number,
    },
    camper_pricing_logic: JSONLogic,
    registration_pricing_logic: JSONLogic,
    confirmation_page_template: Template,
    confirmation_email_subject: string,
    confirmation_email_template: Template,
    confirmation_email_from: string,
    organization: number,
  }

  export interface ApiOrganization {
    id: number,
    created_at: string | null,
    updated_at: string | null,
    deleted_at: string | null,
    name: string,
  }
}

