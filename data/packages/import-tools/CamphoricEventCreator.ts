/**
 * Import test event data
 *
 * Sample use
 *
 * ```
 * const event = new CamphoricEventCreator({
 *   data,
 *   sampleRegGenerator
 *   overrides,
 *   url,
 * });
 *
 * event.send();
 * ```
 *
 * Arguments
 * ---------
 *
 * data: an event import object (the spec's EventImport), checked first with
 * `validate`, the spec's validateEventImport, and then for names it refers to
 * (a promo code's excluded registration types must be the event's). Every
 * field of `data.event` is sent to the events API as-is, including optional
 * ones such as `registration_error_messages` (custom validation messages for
 * the registration form), except its emails' fields, which are set on the
 * event's confirmation and invoice email templates.
 *
 * sampleRegGenerator: a SampleRegGenerator, called with
 *   - fetch: a fetch function
 *   - results: the data generated so far of the event creation
 *   - log: a log function
 * This function should return an array of objects which can be POSTed to the
 * register endpoint.
 *
 *
 */

import { oraPromise } from 'ora';
import cliProgress from 'cli-progress';
import lodash from 'lodash';

import Fetcher from './CamphoricFetcher.ts';
import { Organizations, type Organization } from './organizations.ts';
import type {
  ImportData,
  ImportResults,
  LodgingNode,
  Override,
  SampleRegGenerator,
  SampleRegistration,
  Saved,
  SavedResults,
} from './types.ts';
import { formatDate, formatDateTime } from './utils.ts';

export interface CamphoricEventCreatorOptions {
  data: ImportData;
  // Checks the data before anything is sent, returning its problems (none
  // when it's valid): pass the spec's validateEventImport.
  validate: (data: unknown) => unknown[];
  sampleRegGenerator?: SampleRegGenerator;
  overrides?: Override[];
  // The organizations already loaded; fetched from the server when not given
  organizations?: Organizations;
  url?: string;
}

// A sample registration, with the server's answer to its last step
type PostedRegistration = SampleRegistration & { response: Record<string, unknown> };

// An email template's fields the import sets: undefined leaves one as it is
type EmailTemplateFields = Record<string, string | undefined>;

// One template's result from GET /api/events/<id>/templates/check
interface TemplateCheckResult {
  kind: string;
  label: string;
  diagnostics: { severity: string, message: string, line?: number | null, field?: string | null }[];
}

// A group email's fields, as a new template has them: one the data leaves out
// is set to this, so a template matched by name ends up as the data declares it.
const GROUP_EMAIL_DEFAULTS = {
  from_email: '',
  reply_to: '',
  recipient_source: 'registrations',
  filter: {},
  filter_expression: '',
  address_expression: '',
  name_expression: '',
  recipient_list: '',
  include_incomplete: false,
};

// Likewise for a promo code
const PROMO_CODE_DEFAULTS = {
  scope: 'registration',
  enabled: true,
  expiration_date: null,
  excluded_registration_types: [],
  excludes_uninvited: false,
};

/**
 * What the import data names that it doesn't hold: each promo code's excluded
 * registration types must be among the event's. An empty list when there are
 * none.
 */
export function referenceProblems(data: ImportData): string[] {
  const typeNames = new Set(data.registration_types.map(t => t.name));
  return (data.promo_codes ?? []).flatMap(promo => (promo.excluded_registration_types ?? [])
    .filter(name => !typeNames.has(name))
    .map(name => `promo code '${promo.code}' excludes registration type '${name}', which the event doesn't have`));
}

/** The problems a template check found that are errors, by template. */
export function templateErrors(results: TemplateCheckResult[]): string[] {
  return results.flatMap(result => result.diagnostics
    .filter(d => d.severity === 'error')
    .map(d => {
      const where = [d.field, d.line ? `line ${d.line}` : ''].filter(Boolean).join(', ');
      return `${result.label}${where ? ` (${where})` : ''}: ${d.message}`;
    }));
}

/**
 * Requests started ahead of the Promise.all that collects them, pausing
 * between batches so the server keeps up. Each is handled as it starts, so
 * one that fails during a pause isn't an unhandled rejection (which ends the
 * process, skipping the other events and any cleanup); once one has failed,
 * `failed` says to start no more. Promise.all still rejects with its error.
 */
export function requestBatch() {
  let failed = false;
  return {
    get failed() { return failed; },
    start<T>(request: Promise<T>): Promise<T> {
      request.catch(() => { failed = true; });
      return request;
    },
  };
}

export default class CamphoricEventCreator extends Fetcher {
  declare data: ImportData;
  sampleRegGenerator?: SampleRegGenerator;
  overrides: Override[];
  results: ImportResults;
  organization?: Promise<Organization | undefined>;

  constructor({ data, validate, organizations, sampleRegGenerator, overrides = [], url }: CamphoricEventCreatorOptions) {
    super(url);

    this.data = data;

    const errors = validate(data);

    if (errors.length) {
      throw this.error(
        'event data object did not pass JSON schema validation',
        ...errors,
      );
    }

    const references = referenceProblems(data);

    if (references.length) {
      throw this.error('event data object names what it does not hold', ...references);
    }

    this.setOrganizations(organizations, data.organization);

    if (sampleRegGenerator) {
      if (typeof sampleRegGenerator !== 'function') {
        throw new Error('sample registration generator passed should be a function');
      }

      this.sampleRegGenerator = sampleRegGenerator;
    }

    if (!Array.isArray(overrides)) {
      throw new Error('overrides passed should be an array');
    }

    if (overrides.find(e => typeof e !== 'function')) {
      throw new Error('all items in overrides be functions');
    }

    this.overrides = overrides;

    this.results = {};
  }

  pathFormat(path: string): string {
    if (path.charAt(path.length - 1) !== '/') {
      path += '/';
    }

    return path;
  }

  // The saved event, which every step after loadEvent() needs
  savedEvent(): Saved {
    if (!this.results.event) {
      throw this.error('the event has not been saved yet');
    }

    return this.results.event;
  }

  // What has been saved, once the event has
  savedResults(): SavedResults {
    this.savedEvent();

    return this.results as SavedResults;
  }

  async deleteAll(path: string) {
    const event = this.savedEvent();
    const existing: Saved[] = await this.fetch('GET', path)
      .then((all: Saved[]) => all.filter(i => i.event === event.id));

    await Promise.all(existing.map(
      l => this.fetch('DELETE', `${this.pathFormat(path)}${l.id}/`)
    ));
  }

  async loadEvent() {
    const org = await this.organization;
    if (!org) {
      throw this.error(`organization '${this.data.organization}' not found`);
    }

    const events: Saved[] = await this.fetch('GET', '/api/events/');

    const existingEvent = events.find(event => event.name === this.data.event.name);

    const emailAccounts: Saved[] = await this.fetch('GET', '/api/emailaccounts/');
    const email = emailAccounts.find(e => e.organization === org.id);

    // The confirmation and invoice emails are the event's email templates,
    // updated below.
    const {
      confirmation_email_subject,
      confirmation_email_template,
      confirmation_email_reply_to,
      invoice_email_subject,
      invoice_email_template,
      invoice_email_from,
      invoice_email_reply_to,
      ...eventData
    } = this.data.event;
    const event: Record<string, unknown> = {
      organization: org.id,
      ...eventData,
      // The event's dates are days; its registration window is instants.
      start: formatDate(eventData.start),
      end: formatDate(eventData.end),
      registration_start: formatDateTime(eventData.registration_start),
      registration_end: formatDateTime(eventData.registration_end),
    };

    if (existingEvent) {
      event.id = existingEvent.id;
    }

    if (email) {
      event.email_account = email.id;
      event.confirmation_email_from =
        event.confirmation_email_from || email.account;
    }

    const eventResponse: Saved = await this.fetch(
      existingEvent ? 'PUT' : 'POST',
      `/api/events/${existingEvent ? event.id : ''}`,
      event,
    );

    await this.updateEmailTemplate(eventResponse.confirmation_template, {
      subject: confirmation_email_subject,
      body: confirmation_email_template,
      reply_to: confirmation_email_reply_to,
    });
    await this.updateEmailTemplate(eventResponse.invoice_template, {
      subject: invoice_email_subject,
      body: invoice_email_template,
      from_email: invoice_email_from,
      reply_to: invoice_email_reply_to,
    });

    this.results.event = eventResponse;
    return eventResponse;
  }

  // An event's confirmation and a registration type's invitation are email
  // templates, created with them (SPEC DR-45); set the text the data gives.
  async loadEmailTemplate(templateId: unknown, subject?: string, body?: string) {
    await this.updateEmailTemplate(templateId, { subject, body });
  }

  // Set the fields of an email template created with its event or
  // registration type that the data gives (an undefined one is left as is).
  async updateEmailTemplate(templateId: unknown, fields: EmailTemplateFields) {
    const given = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    if (!templateId || !Object.keys(given).length) return;
    await this.fetch('PATCH', `/api/emailtemplates/${templateId}/`, given);
  }

  async loadLodgings() {
    const event = this.savedEvent();
    const progBar = new cliProgress.SingleBar(
      {
        format: 'importing lodging [{bar}] {percentage}% | {value}/{total}',
        clearOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );

    // delete existing lodgings associated with this event, so we start clean
    await this.deleteAll('/api/lodgings/');

    if (!this.data.lodgings) {
      return;
    }

    const lodgingLookup = this.data.lodgings;
    const lodgingEntries = Object.entries(lodgingLookup);
    let completed = 0;
    progBar.start(lodgingEntries.length, 0);

    const createLodging = async (key: string, lodging: LodgingNode): Promise<unknown> => {
      let data, createdLodging: Saved | undefined;
      try {
        data = {
          event: event.id,
          parent: lodging.parentKey ? lodgingLookup[lodging.parentKey].id : null,
          name: lodging.name,
          children_title: lodging.children_title,
          visible: lodging.visible,
          capacity: lodging.capacity || 0,
          reserved: lodging.reserved || 0,
          sharing_multiplier: lodging.sharing_multiplier || 1,
          notes: lodging.notes || '',
          availability: lodging.availability || 'auto',
        };
        const saved: Saved = await this.fetch('POST', '/api/lodgings/', data);
        createdLodging = saved;

        completed += 1;
        progBar.update(completed);
        this.logVerbose(`created lodging ${completed}/${lodgingEntries.length}`);

        lodgingLookup[key].id = saved.id;
      } catch (e) {
        throw this.error(e, {type: 'lodgingDataAttempted', key, data, createdLodging});
      }

      // batch requests so that it doesn't time out
      const promises = [];
      const requests = requestBatch();
      const all = lodgingEntries.filter(([, l]) => l.parentKey === key);
      for (let i = 0; i < all.length && !requests.failed; ++i) {
        promises.push(requests.start(createLodging(...all[i])));

        if (promises.length % 10 === 0) await this.wait(5000);
      }

      return Promise.all(promises);
    };

    // recursively add all lodgings starting with root
    await createLodging('root', lodgingLookup.root);
    progBar.stop();

    this.results.lodging = lodgingLookup;
  }

  async loadReports() {
    const event = this.savedEvent();
    this.results.reports = await Promise.all(this.data.reports.map(
      report => this.fetch('POST', '/api/reports/', {
        event: event.id,
        // data/ reports use the browser's variable bundle unless they say otherwise.
        variables_source: 'client',
        ...report,
      })
    ));
  }

  async loadCustomChargeTypes() {
    const { custom_charge_types } = this.data;

    if (!custom_charge_types || !custom_charge_types.length) return;

    const event = this.savedEvent();

    const response: Saved[] = await this.fetch('GET', '/api/customchargetypes/');

    const existing = response.filter(ctype => ctype.event === event.id);

    await Promise.all(
      custom_charge_types.map(
        async (customChargeType) => {
          const exists = existing.find(r => r.name === customChargeType.name);

          return this.fetch(
            exists ? 'PUT' : 'POST',
            `/api/customchargetypes${exists ? `/${exists.id}` : ''}/`,
            {
              ...customChargeType,
              ...(exists ? { id: exists.id } : {}),
              event: event.id,
            },
          );
        }
      )
    );
  }

  async loadRegTypes() {
    const event = this.savedEvent();

    const response: Saved[] = await this.fetch('GET', '/api/registrationtypes/');

    const existingRegTypes = response.filter(regType => regType.event === event.id);

    this.results.registration_types = await Promise.all(
      this.data.registration_types.map(
        async (regType) => {
          const exists = existingRegTypes.find(r => r.name === regType.name);

          const {
            invitation_email_subject: subject,
            invitation_email_template: body,
            invitation_email_from: from_email,
            invitation_email_reply_to: reply_to,
            ...typeData
          } = regType;

          const saved: Saved = await this.fetch(
            exists ? 'PUT' : 'POST',
            `/api/registrationtypes${exists ? `/${exists.id}` : ''}/`,
            {
              ...typeData,
              ...(exists ? { id: exists.id } : {}),
              event: event.id,
            },
          );
          await this.updateEmailTemplate(saved.invitation_template, { subject, body, from_email, reply_to });
          return saved;
        }
      )
    );
  }

  // The event's group emails (SPEC §8.9): each one the data declares is
  // created, or, when the event has one by its name, updated to match.
  // Others the event has are left alone.
  async loadGroupEmails() {
    const { email_templates } = this.data;

    if (!email_templates || !email_templates.length) return;

    const event = this.savedEvent();
    const all: Saved[] = await this.fetch('GET', '/api/emailtemplates/');
    const existing = all.filter(t => t.event === event.id && t.purpose === 'group');

    this.results.email_templates = await Promise.all(email_templates.map((template) => {
      const exists = existing.find(t => t.name === template.name);

      return this.fetch(
        exists ? 'PUT' : 'POST',
        `/api/emailtemplates/${exists ? `${exists.id}/` : ''}`,
        { ...GROUP_EMAIL_DEFAULTS, ...template, purpose: 'group', event: event.id },
      ) as Promise<Saved>;
    }));
  }

  // The event's promo codes (SPEC DR-67): each one the data declares is
  // created, or, when the event has a live one with its code (ignoring case),
  // updated to match. Its excluded registration types are given by name, so
  // this runs once they're saved. Others the event has are left alone.
  async loadPromoCodes() {
    const { promo_codes } = this.data;

    if (!promo_codes || !promo_codes.length) return;

    const event = this.savedEvent();
    const regTypes = this.results.registration_types ?? [];
    // Every code is worked out before any is sent, so a problem sends none.
    const bodies = promo_codes.map((promo) => {
      const excluded = (promo.excluded_registration_types ?? []).map((name) => {
        const regType = regTypes.find(t => t.name === name);
        if (!regType) {
          throw this.error(`promo code '${promo.code}' excludes registration type '${name}', which was not imported`);
        }
        return regType.id;
      });

      // An expiry that can't be read must not save as "never expires"
      const expiration = formatDateTime(promo.expiration_date);
      if (promo.expiration_date !== undefined && expiration === undefined) {
        throw this.error(`promo code '${promo.code}' has an expiration_date that can't be read: '${promo.expiration_date}'`);
      }

      return {
        ...PROMO_CODE_DEFAULTS,
        ...promo,
        expiration_date: expiration ?? null,
        excluded_registration_types: excluded,
        event: event.id,
      };
    });

    const all: Saved[] = await this.fetch('GET', '/api/promocodes/');
    const existing = all.filter(p => p.event === event.id);
    const sameCode = (a: unknown, b: string) => String(a).trim().toLowerCase() === b.trim().toLowerCase();

    this.results.promo_codes = await Promise.all(bodies.map((body) => {
      const exists = existing.find(p => sameCode(p.code, body.code));

      return this.fetch(
        exists ? 'PUT' : 'POST',
        `/api/promocodes/${exists ? `${exists.id}/` : ''}`,
        body,
      ) as Promise<Saved>;
    }));
  }

  // Check every template of the event through the server (SPEC §9.3), as
  // `manage.py check_templates` does: each is rendered against the event's
  // registrations (or, with none, parsed), so one that won't render fails the
  // import rather than its first send.
  async checkTemplates() {
    const event = this.savedEvent();
    const token = await this.getAuthToken();
    // (Not this.fetch, which ends every path with a slash: this one has none.)
    const res = await fetch(`${this.urlBase}/api/events/${event.id}/templates/check`, {
      headers: { 'Authorization': `Token ${token}` },
    });
    const text = await res.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw this.error(`template check returned non-JSON (${res.status})`, { status: res.status, body: text });
    }

    if (!res.ok) {
      throw this.error(`template check failed (${res.status})`, { status: res.status, response: json });
    }

    const errors = templateErrors(json.results ?? []);
    if (errors.length) {
      throw this.error(`${errors.length} template problem(s): ${errors.join('; ')}`, ...errors);
    }
  }

  async loadTestRegs() {
    if (!this.sampleRegGenerator) return [];

    const token = await this.getAuthToken();
    const registrations = await this.sampleRegGenerator.bind(this)(
      this.fetch.bind(this),
      this.savedResults(),
      this.log.bind(this),
    );

    const event = this.savedEvent();

    const postReg = async (testData: SampleRegistration): Promise<PostedRegistration> => {
      const res = await fetch(`${this.urlBase}/api/events/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Signed in, so the server's throttle on anonymous registration steps
          // (#801) leaves the sample registrations alone.
          'Authorization': `Token ${token}`,
        },
        body: JSON.stringify({
          step: 'registration',
          formData: testData.formData,
          pricingResults: testData.pricingResults,
        }),
      });

      const text = await res.text();

      // A rejected test registration is a real import failure (a broken schema or
      // pricing logic), so fail loudly instead of logging and exiting 0.
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw this.error(
          `[reg step] test registration returned non-JSON (${res.status}), see Django logs`,
          { status: res.status, body: text },
        );
      }

      if (!res.ok) {
        throw this.error(
          `[reg step] test registration rejected (${res.status})`,
          { type: 'testRegistration', response: json, sent: testData.formData },
        );
      }

      return {
        ...testData,
        response: json || {},
      };
    };

    const postPayment = async (testData: PostedRegistration): Promise<PostedRegistration> => {
      // Test registrations pay by check: a PayPal payment needs a payer to
      // approve it in PayPal's window (SPEC §7.2). The server works out the
      // amount from the payment option (the event's default when none is given).
      const paymentOption = lodash.get(testData, 'paymentData.paymentOption');

      // The registration step's quote: the server completes it only at that price.
      const { quote } = testData.response;
      const body = {
        step: 'payment',
        registrationUUID: testData.response.registrationUUID,
        paymentType: 'Check',
        ...(paymentOption ? { paymentOption } : {}),
        ...(typeof quote === 'string' ? { quote } : {}),
      };

      const res = await fetch(`${this.urlBase}/api/events/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Signed in, so the server's throttle on anonymous registration steps
          // (#801) leaves the sample registrations alone.
          'Authorization': `Token ${token}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw this.error(
          `[pay step] test payment returned non-JSON (${res.status}), see Django logs`,
          { status: res.status, body: text },
        );
      }

      if (!res.ok) {
        throw this.error(
          `[pay step] test payment rejected (${res.status})`,
          { type: 'testPayment', response: json, sent: body },
        );
      }

      return {
        ...testData,
        response: json || {},
      };

    };

    if (!Array.isArray(registrations)) {
      throw new Error('sample reg generator function returned a non-array');
    }

    // get first step responses
    const step1 = [];
    const registering = requestBatch();
    for (let i = 0; i < registrations.length && !registering.failed; ++i) {
      step1.push(registering.start(postReg(registrations[i])));

      if (i % 10 === 0) await this.wait(1500);
    }
    const responses = await Promise.all(step1);

    // process payment step
    const step2 = [];
    const paying = requestBatch();
    for (let i = 0; i < responses.length && !paying.failed; ++i) {
      step2.push(paying.start(postPayment(responses[i])));

      if (i % 10 === 0) await this.wait(1500);
    }

    return Promise.all(step2);
  }

  async create() {
    this.log(`🟢 Starting Import of ${this.data.event.name}!`);

    const imp = (label: string, p: Promise<unknown>) => oraPromise(
      p,
      {
        text: `[${this.data.event.name}] import ${label}`,
        spinner: 'clock',
      }
    );

    await imp('organization', Promise.resolve(this.organization));
    await imp('event', this.loadEvent());
    await imp('custom charge types', this.loadCustomChargeTypes());
    await imp('reports', this.loadReports());
    await imp('registration types', this.loadRegTypes());
    await imp('group emails', this.loadGroupEmails());
    await imp('promo codes', this.loadPromoCodes());

    await this.loadLodgings();
    await imp('lodging', Promise.resolve());

    // Run the overrides in series in case order matters
    for (let i = 0; i < this.overrides.length; i++) {
      const fn = this.overrides[i].bind(this);

      await imp(`override[${i}]`, fn(this.fetch.bind(this), this.savedResults(), this.log.bind(this)));
    }

    // SKIP_TEST_REGS=1 skips the sample registrations (e.g. where a sample would
    // need a live PayPal sandbox); everything else still imports.
    if (this.sampleRegGenerator && process.env.SKIP_TEST_REGS !== '1') {
      await imp('test registrations', this.loadTestRegs());
    }

    // After the sample registrations, so the templates render against them
    await imp('template check', this.checkTemplates());

    this.log(`🎉 Finished Importing ${this.data.event.name}!`);

    return true;
  }

  setOrganizations = async (organizations: Organizations | undefined, organization: string | number) => {
    if (!(organizations instanceof Organizations)) {
      organizations = new Organizations(
        await this.fetch('GET', '/api/organizations/')
      );
    }

    // get organization
    this.organization = new Promise(
      r => r(organizations.byId[organization] || organizations.byName[organization])
    );

    if (!await this.organization) {
      throw new Error(`organization '${organization}' not found`);
    }
  };
}
