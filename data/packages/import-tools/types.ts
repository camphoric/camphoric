/**
 * The parts of an event module these tools use, as structural types: the
 * same shapes as @camphoric/camphoric-event-import-spec's (a test in the
 * importer keeps them compatible), kept here so the tools depend on no
 * particular spec version.
 */

import type { FetchMethod, Saved } from './CamphoricFetcher.ts';

export type { FetchMethod, Saved };

/** An authenticated request to the Camphoric API, resolving to its JSON. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Fetch = (method: FetchMethod, path: string, data?: unknown) => Promise<any>;

export type Log = (...data: unknown[]) => void;

/** A lodging node; once saved, it carries the id the server gave it. */
export interface LodgingNode {
  parentKey?: string;
  children_title?: string;
  capacity?: number;
  reserved?: number;
  sharing_multiplier?: number;
  visible?: boolean;
  name?: string;
  notes?: string;
  availability?: 'auto' | 'full' | 'open';
  id?: number;
}

/** The lodging tree, flattened: every node by key, starting from `root`. */
export type Lodgings = { root: LodgingNode } & Record<string, LodgingNode>;

/** The event import object, as far as the importer reads it. */
export interface ImportData {
  organization: string | number;
  event: {
    name: string;
    start?: string;
    end?: string;
    registration_start?: string;
    registration_end?: string;
    confirmation_email_subject?: string;
    confirmation_email_template?: string;
    confirmation_email_reply_to?: string;
    invoice_email_subject?: string;
    invoice_email_template?: string;
    invoice_email_from?: string;
    invoice_email_reply_to?: string;
    [field: string]: unknown;
  };
  lodgings?: Lodgings;
  reports: { [field: string]: unknown }[];
  custom_charge_types?: { name: string, [field: string]: unknown }[];
  registration_types: {
    name: string,
    invitation_email_subject: string,
    invitation_email_template: string,
    invitation_email_from?: string,
    invitation_email_reply_to?: string,
    [field: string]: unknown,
  }[];
  // Group emails, matched to the saved ones by name
  email_templates?: { name: string, [field: string]: unknown }[];
  // Matched to the saved ones by code, ignoring case
  promo_codes?: {
    code: string,
    expiration_date?: string,
    // registration type names
    excluded_registration_types?: string[],
    [field: string]: unknown,
  }[];
}

/** What the importer has saved so far, for overrides and sample registrations. */
export interface ImportResults {
  event?: Saved;
  lodging?: Lodgings;
  reports?: Saved[];
  registration_types?: Saved[];
  email_templates?: Saved[];
  promo_codes?: Saved[];
}

/** What has been saved by the time an event's overrides and sample registrations run. */
export type SavedResults = ImportResults & { event: Saved };

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

/** A step run once the event, its lodging and its registration types are saved. */
export type Override = (fetch: Fetch, results: SavedResults, log: Log) => Promise<unknown>;

/** What an event module exports as its default, as far as importing it goes. */
export interface ImportableEvent {
  data: ImportData;
  organization: OrganizationImport;
  sampleRegGenerator?: SampleRegGenerator;
  overrides?: Override[];
}

/** The organization an event belongs to, with the email account it sends from. */
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
