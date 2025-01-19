#!/usr/bin/env node --no-warnings

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
 * data: an object which conforms to the JSON schema in
 * ./eventImportObjectSchema.js
 *
 * sampleRegistrationGenerator: an async function with the following signature
 *   - results: the data generated so far of the event creation
 *   - fetcher: a fetch function
 * This function should return an array of objects which can be POSTed to the
 * camper endpoint.
 *
 *
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { oraPromise } from 'ora';
import cliProgress from 'cli-progress';
import lodash from 'lodash';

import { Organizations } from './organizations/index.js';
import { formatDate } from './utils.js';
import eventImportObjectSchema from './eventImportObjectSchema.js';
import Fetcher from './CamphoricFetcher.js';

export default class CamphoricEventCreator extends Fetcher {
  constructor({ data, organizations, sampleRegGenerator, overrides = [], url }) {
    super(url);

    this.data = data;

    const ajv = new Ajv({
      allowUnionTypes: true,
    });
    addFormats(ajv);

    const valid = ajv.validate(eventImportObjectSchema, data);

    if (!valid) {
      throw this.error(
        'event data object did not pass JSON schema validation',
        ...ajv.errors,
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

  pathFormat(path) {
    if (path.charAt(path.length - 1) !== '/') {
      path += '/';
    }

    return path;
  }

  async deleteAll(path) {
    const { event } = this.results;
    const existing = await this.fetch('GET', path)
      .then(all => all.filter(i => i.event === event.id));

    await Promise.all(existing.map(
      l => this.fetch('DELETE', `${this.pathFormat(path)}${l.id}/`)
    ));
  }

  async loadEvent() {
    const org = await this.organization;
    const events = await this.fetch('GET', '/api/events/');

    const existingEvent = events.find(event => event.name === this.data.event.name);

    const emailAccounts = await this.fetch('GET', '/api/emailaccounts/');
    const email = emailAccounts.find(e => e.organization === org.id);

    const event = {
      organization: org.id,
      ...this.data.event,
      ...['registration_start', 'registration_end', 'start', 'end'].reduce(
        (acc, k) => ({
          ...acc,
          [k]: formatDate(this.data.event[k]),
        }), {},
      )
    };

    if (existingEvent) {
      event.id = existingEvent.id;
    }

    if (email) {
      event.email_account = email.id;
      event.confirmation_email_from =
        event.confirmation_email_from || email.account;
    }

    const eventResponse = await this.fetch(
      existingEvent ? 'PUT' : 'POST',
      `/api/events/${existingEvent ? event.id : ''}`,
      event,
    );

    this.results.event = eventResponse;
    return eventResponse;
  }

  async loadLodgings() {
    const { event } = this.results;
    const progBar = new cliProgress.SingleBar(
      {
        format: 'importing lodging [{bar}] {percentage}% | {value}/{total}',
        clearOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );

    // delete existing lodgings associated with this event, so we start clean
    try {
      await this.deleteAll('/api/lodgings/');
    } catch (e) {
      // nothing, we don't care
    }

    if (!this.data.lodgings) {
      return;
    }

    const lodgingLookup = this.data.lodgings;
    const lodgingEntries = Object.entries(lodgingLookup);
    let completed = 0;
    progBar.start(lodgingEntries.length, 0);

    const createLodging = async (key, lodging) => {
      let data, createdLodging;
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
        };
        createdLodging = await this.fetch('POST', '/api/lodgings/', data);

        completed += 1;
        progBar.update(completed);
        this.logVerbose(`created lodging ${completed}/${lodgingEntries.length}`);

        lodgingLookup[key].id = createdLodging.id;
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
    const { event } = this.results;
    this.results.reports = await Promise.all(this.data.reports.map(
      report => this.fetch('POST', '/api/reports/', {
        event: event.id,
        ...report,
      })
    ));
  }

  async loadCustomChargeTypes() {
    const { custom_charge_types } = this.data;

    if (!custom_charge_types || !custom_charge_types.length) return;

    const { event } = this.results;

    let response = await this.fetch('GET', '/api/customchargetypes/');

    const existing = response.filter(ctype => ctype.event === event.id);

    await Promise.all(
      custom_charge_types.map(
        async (customChargeType) => {
          const exists = existing.find(r => r.name === ctype.name);

          if (exists) {
            customChargeType.id = exists.id;
          }

          customChargeType.event = event.id;

          return this.fetch(
            exists ? 'PUT' : 'POST', 
            `/api/customchargetypes${exists ? `/${customChargeType.id}` : ''}/`,
            customChargeType,
          );
        }
      )
    );
  }

  async loadRegTypes() {
    const { event } = this.results;

    let response = await this.fetch('GET', '/api/registrationtypes/');

    const existingRegTypes = response.filter(regType => regType.event === event.id);

    await Promise.all(
      this.data.registration_types.map(
        async (regType) => {
          const exists = existingRegTypes.find(r => r.name === regType.name);

          if (exists) {
            regType.id = exists.id;
          }

          regType.event = event.id;

          return this.fetch(
            exists ? 'PUT' : 'POST', 
            `/api/registrationtypes${exists ? `/${regType.id}` : ''}/`,
            regType,
          );
        }
      )
    );
  }

  async loadTestRegs() {
    const token = await this.getAuthToken();
    const registrations = await this.sampleRegGenerator.bind(this)(
      this.fetch,
      this.results,
      this.log,
    );

    const event = this.results.event;

    const postReg = async (testData) => {
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

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error(' [reg step] failed to add test reg, see Django logs');
      }

      if (!res.ok) {
        console.error(' [reg step] failed to add test reg, see Django logs');
        if (json) console.log(json);
      }

      return {
        ...testData,
        response: json || {},
      };
    };

    const postPayment = async (testData) => {
      const paymentType =
        lodash.get(testData, 'paymentData.paymentType') ||
        lodash.get(testData, 'formData.payment_type');

      const total =
        lodash.get(testData, 'paymentData.total') ||
        lodash.get(testData, 'response.serverPricingResults.total');

      const payPalResponse =
        lodash.get(testData, 'paymentData.payPalResponse') || undefined;

      const otherPaymentData = 
        lodash.get(testData, 'paymentData.otherPaymentData') || {};

      const body = {
        step: 'payment',
        registrationUUID: testData.response.registrationUUID,
        paymentType,
        payPalResponse,
        paymentData: {
          total,
          ...otherPaymentData,
        },
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
        console.error(' [pay step] failed to add test reg, see Django logs');
      }

      if (!res.ok) {
        console.error(' [pay step] failed to add test reg, see Django logs');
        if (json) console.log(json);
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

    const imp = (label, p) => oraPromise(
      p,
      {
        text: `[${this.data.event.name}] import ${label}`,
        spinner: 'clock',
      }
    );

    await imp('organization', this.organization);
    await imp('event', this.loadEvent());
    await imp('custom charge types', this.loadCustomChargeTypes());
    await imp('reports', this.loadReports());
    await imp('registration types', this.loadRegTypes());

    await this.loadLodgings();
    await imp('lodging', Promise.resolve());

    // Run the overrides in series in case order matters
    for (let i = 0; i < this.overrides.length; i++) {
      const fn = this.overrides[i].bind(this);

      await imp(`override[${i}]`, fn(this.fetch.bind(this), this.results, this.log.bind(this)));
    }

    if (this.sampleRegGenerator) {
      await imp('test registrations', this.loadTestRegs());
    }

    this.log(`🎉 Finished Importing ${this.data.event.name}!`);

    return true;
  }

  setOrganizations = async (organizations, organization) => {
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
