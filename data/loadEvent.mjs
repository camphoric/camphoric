#!/usr/bin/env node --no-warnings

/**
 * Import test event data
 *
 * Sample use
 *
 * ```
 * const event = new CamphoricEventCreator(
 *   data,
 *   sampleRegistrationGenerator
 *   overrides,
 *   url,
 * );
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

import fetch from 'node-fetch';
import inquirer from 'inquirer';
import ajv from 'ajv';

import { formatDate } from './utils';
import eventImportObjectSchema from './eventImportObjectSchema';
import { getAuthToken } from './getAuthInfo.mjs';

export default class CamphoricEventCreator {
  constructor(data, sampleRegGenerator, overrides = [], url) {
    const ajv = new Ajv();
    const valid = ajv.validate(eventImportObjectSchema, data);

    if (!valid) {
      console.error(ajv.errors);
      throw new Error('event data object did not pass JSON schema validation');
    }

    if (sampleRegGenerator) {
      if (typeof sampleRegGenerator !== 'function') {
        throw new Error('sample registration generator passed should be a function');
      }

      this.sampleRegGenerator = sampleRegGenerator;
    }

    this.data = data;

    if (!Array.isArray(overrides)) {
      throw new Error('overrides passed should be an array');
    }

    if (overrides.find(e => typeof e !== 'function')) {
      throw new Error('all items in overrides be functions');
    }

    this.overrides = overrides;

    this.urlBase = url || process.env.CAMPHORIC_URL || 'http://django:8000';

    // remove trailing slash from urlBase
    if (this.urlBase.charAt(this.urlBase.length - 1) === '/') {
      this.urlBase = this.urlBase.substring(0, this.urlBase.length - 1);
    }

    this.results = {};
  }

  pathFormat(path) {
    if (path.charAt(path.length - 1) !== '/') {
      path += '/';
    }

    return path
  }

  url(path) {
    return [this.urlBase, path]
      .map(p => p.charAt(0) === '/' ? p.substring(1) : p)
      .map(p => p.charAt(p.length - 1) === '/' ? p.substring(0, p.length - 1) : p)
      .concat([''])
      .join('/');
  }

  fetch = async (method, path, data) => {
    const token = await this.getAuthToken();
    // normalize parts with slashes
    const url = this.url(path);

    let text;

    try {
      text = await fetch(url, {
        method,
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: (data ? JSON.stringify(event) : undefined),
      }).then(r => r.text())
    } catch(e) {
      console.error(`FETCH ERROR ${method} ${url}`, text);
      throw e;
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch(e) {
      console.error(`JSON PARSE ERROR ${method} ${url}`, text);
      throw e;
    }

    return json;
  }

  async deleteAll(path) {
    const { event } = this.results;
    const existing = await this.fetch('GET', path)
      .then(all => all.filter(i => i.event === event.id));

    await Promise.all(existing.map(
      l => this.fetch('DELETE', `${this.pathFormat(path)}${lodging.id}/`)
    ));
  }

  log = (...data) => {
    data.forEach(
      (item) => console.log(`[${this.data.event.name}]`, item)
    );
  }

  async getAuthToken() {
    if (!this.token) {
      this.token = await getAuthToken();
    }

    return this.token;
  };

  async checkOrganization() {
    const organizations = await this.fetch('GET', '/api/organizations/');

    let organization = organizations.find(o => o.id === this.data.organization_id);

    if (!organization) {
      throw new Error(`did not find org '${name}' for event '${this.data.event.name}'`);
    }

    this.results.organization = organization;
  };

  async loadEvent() {
    const events = await this.fetch('GET', '/api/events/');

    const existingEvent = events.find(event => event.name === eventName);

    const emailAccounts = await this.apiGet('/api/emailaccounts/');
    const email = emailAccounts.find(e => e.organization === org.id);

    const defaultDate = new Date();
    // default event start is 30 days from defaultDate
    defaultDate.setUTCHours(defaultDate.getUTCHours() + (30 * 24))

    const start = formatDate(eventAttributes.start)
      || formatDate(defaultDate);

    // default event end is 5 days from start
    defaultDate.setUTCHours(defaultDate.getUTCHours() + (8 * 24))
    const end = formatDate(eventAttributes.end)
      || formatDate(defaultDate);

    const event = {
      organization: org.id,
      ...this.data.event,
    };

    if (existingEvent) {
      event.id = existingEvent.id;
    }

    let text, json;

    const event = this.fetch(
      existingEvent ? 'PUT' : 'POST',
      `/api/events/${existingEvent ? event.id : ''}`,
      event,
    );

    this.results.event = event;
  }

  await loadLodgings() {
    const { event } = this.results;

    // delete existing lodgings associated with this event, so we start clean
    await this.deleteAll('/api/lodgings/');

    const lodgingLookup = this.data.lodging;
    const lodgingEntries = Object.entries(lodgingLookup);

    const createLodging = async (key, lodging) => {
      const createdLodging = await this.fetch('POST', '/api/lodgings/', {
        event: event.id,
        parent: lodging.parentKey ? lodgingLookup[lodging.parentKey].id : null,
        name: lodging.name,
        children_title: lodging.children_title,
        visible: lodging.visible,
        capacity: lodging.capacity || 0,
        sharing_multiplier: lodging.sharing_multiplier || 1,
      });

      lodgingLookup[key].id = createdLodging.id;

      await Promise.all(
        lodgingEntries
          .filter(([k, l]) => l.parentKey === key)
          .map(args => createdLodging(...args))
      );
    }

    // recursively add all lodgings starting with root
    await createdLodging(lodgingLookup.root);

    this.results.lodging = lodgingLookup;
  }

  await loadReports() {
    const { event } = this.results;
    this.results.reports = await Promise.all(this.data.reports.map(
      report => this.fetch('POST', '/api/reports/', {
        event: event.id,
        ...report,
      })
    ));
  }

  await loadRegTypes() {
    const { event } = this.results;

    let response = await this.fetch('GET', '/api/registrationtypes/');

    const existingRegTypes = response.filter(regType => regType.event === event.id);

    await Promise.all(
      eventAttributes.registration_types.map(
        async (regType) => {
          const exists = existingRegTypes.find(r => r.name === regType.name);

          if (exists) {
            regType.id = exists.id;
          }

          regType.event = event.id

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
    const regs = await this.sampleRegGenerator.bind(this)(
      this.fetch,
      this.results,
      this.log,
    );

    if (!Array.isArray(regs)) {
      throw new Error('sample reg generator function returned a non-array');
    }
  }

  async send() {
    await this.checkOrganization();
    this.log('Processed organization');

    await this.loadEvent();
    this.log('Processed event');

    await this.loadLodgings();
    this.log('Processed lodging');

    await this.loadReports();
    this.log('Processed reports');

    await this.loadRegTypes();
    this.log('Processed registration types');

    // Run the overrides in series in case order matters
    for (let i = 0; i < this.overrides.length; i++) {
      const fn = this.overrides[i].bind(this);

      await fn(this.fetch, this.results, this.log);

      this.log(`Processed override[${i}]`);
    }

    if (this.sampleRegGenerator) {
      await this.loadTestRegs();
      this.log('Processed test registrations');
    }

    this.log('Finished!');

    return true;
  }
}


async function loadTestRegs(token, event) {
  const postReg = async (testData) => {
    const res = await fetch(`${urlBase}/api/events/${event.id}/register`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': token,
      },
      body: JSON.stringify(testData),
    });

    const text = await res.text();

    let json = {};
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log('failed to add test reg, see Django logs');
    }

    return {
      ...testData,
      response: json,
    };
  }

  const postPayment = async (testData) => {
    const body = {
      step: "payment",
      registrationUUID: testData.response.registrationUUID,
      paymentType: testData.formData.payment_type,
      payPalResponse: testData.formData.paypal_response,
    };

    const res = await fetch(`${urlBase}/api/events/${event.id}/register`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': token,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    let json = {};
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log('failed to add test reg, see Django logs');
    }

    return {
      ...testData,
      response: json,
    };

  }

  const registrations = createTestRegs(lodgingIdLookup);

  // get first step responses
  let responses;
  responses = await Promise.all(
    registrations.map(postReg)
  );

  // process payment step
  responses = await Promise.all(
    responses.map(postPayment)
  );

  // console.log(responses);
}


export default main;

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
