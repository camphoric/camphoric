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
    [field: string]: unknown;
  };
  lodgings?: Lodgings;
  reports: { [field: string]: unknown }[];
  custom_charge_types?: { name: string, [field: string]: unknown }[];
  registration_types: {
    name: string,
    invitation_email_subject: string,
    invitation_email_template: string,
    [field: string]: unknown,
  }[];
}

/** What the importer has saved so far, for overrides and sample registrations. */
export interface ImportResults {
  event?: Saved;
  lodging?: Lodgings;
  reports?: Saved[];
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
