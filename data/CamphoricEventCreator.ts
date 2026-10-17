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
 * data: an EventImport, which conforms to the JSON schema in
 * camphoric-event-import-spec. Every field of `data.event` is sent to the
 * events API as-is, including optional ones such as
 * `registration_error_messages` (custom validation messages for the
 * registration form).
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

import { Organizations, type Organization } from './organizations.ts';
import { formatDate, formatDateTime } from './utils.ts';
import {
  validateEventImport,
  type EventImport,
  type EventModule,
  type ImportResults,
  type LodgingNode,
  type Override,
  type SampleRegGenerator,
  type SampleRegistration,
  type Saved,
  type SavedResults,
} from 'camphoric-event-import-spec';
import Fetcher from 'camphoric-event-import-tools/fetcher';

export interface CamphoricEventCreatorOptions extends Omit<EventModule, 'organization'> {
  // The organizations already loaded; fetched from the server when not given
  organizations?: Organizations;
  url?: string;
}

// A sample registration, with the server's answer to its last step
type PostedRegistration = SampleRegistration & { response: Record<string, unknown> };

export default class CamphoricEventCreator extends Fetcher {
  declare data: EventImport;
  sampleRegGenerator?: SampleRegGenerator;
  overrides: Override[];
  results: ImportResults;
  organization?: Promise<Organization | undefined>;

  constructor({ data, organizations, sampleRegGenerator, overrides = [], url }: CamphoricEventCreatorOptions) {
    super(url);

    this.data = data;

    const errors = validateEventImport(data);

    if (errors.length) {
      throw this.error(
        'event data object did not pass JSON schema validation',
        ...errors,
      );
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

    // The confirmation email is the event's email template, updated below.
    const {
      confirmation_email_subject: subject,
      confirmation_email_template: body,
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

    await this.loadEmailTemplate(eventResponse.confirmation_template, subject, body);

    this.results.event = eventResponse;
    return eventResponse;
  }

  // An event's confirmation and a registration type's invitation are email
  // templates, created with them (SPEC DR-45); set the text the data gives.
  async loadEmailTemplate(templateId: unknown, subject?: string, body?: string) {
    if (!templateId || (subject === undefined && body === undefined)) return;
    await this.fetch('PATCH', `/api/emailtemplates/${templateId}/`, {
      ...(subject !== undefined ? { subject } : {}),
      ...(body !== undefined ? { body } : {}),
    });
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
      const all = lodgingEntries.filter(([, l]) => l.parentKey === key);
      for (let i = 0; i < all.length; ++i) {
        promises.push(
          createLodging(...all[i])
        );

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

    await Promise.all(
      this.data.registration_types.map(
        async (regType) => {
          const exists = existingRegTypes.find(r => r.name === regType.name);

          const {
            invitation_email_subject: subject,
            invitation_email_template: body,
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
          await this.loadEmailTemplate(saved.invitation_template, subject, body);
          return saved;
        }
      )
    );
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
          'X-CSRFToken': token,
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
      } catch (e) {
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

      const body = {
        step: 'payment',
        registrationUUID: testData.response.registrationUUID,
        paymentType: 'Check',
        ...(paymentOption ? { paymentOption } : {}),
      };

      const res = await fetch(`${this.urlBase}/api/events/${event.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': token,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
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
    for (let i = 0; i < registrations.length; ++i) {
      step1.push(postReg(registrations[i]));

      if (i % 10 === 0) await this.wait(1500);
    }
    const responses = await Promise.all(step1);

    // process payment step
    const step2 = [];
    for (let i = 0; i < responses.length; ++i) {
      step2.push(postPayment(responses[i]));

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
