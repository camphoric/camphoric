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

import { Organizations } from './organizations/index.js';
import { formatDate } from './utils.js';
import eventImportObjectSchema from './eventImportObjectSchema.js';
import { getAuthToken } from './getAuthInfo.js';

export default class CamphoricEventCreator {
  constructor({ data, organizations, sampleRegGenerator, overrides = [], url }) {
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

    this.urlBase = url || process.env.CAMPHORIC_URL || 'http://django:8000';

    // remove trailing slash from urlBase
    if (this.urlBase.charAt(this.urlBase.length - 1) === '/') {
      this.urlBase = this.urlBase.substring(0, this.urlBase.length - 1);
    }

    this.results = {};

    this.log('event exported');
  }

  pathFormat(path) {
    if (path.charAt(path.length - 1) !== '/') {
      path += '/';
    }

    return path;
  }

  url(path) {
    return [this.urlBase, path]
      .map(p => p.charAt(0) === '/' ? p.substring(1) : p)
      .map(p => p.charAt(p.length - 1) === '/' ? p.substring(0, p.length - 1) : p)
      .concat([''])
      .join('/');
  }

  fetch = async (method, path, data) => {
    if (!['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      throw new Error(`invalid fetch method '${method}'`);
    }

    const token = await this.getAuthToken();
    // normalize parts with slashes
    let url;
    try {
      url = this.url(path);
    } catch (e) {
      throw this.error(e, {type: 'pathError', method, path, data});
    }

    let text;
    let response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: (data ? JSON.stringify(data) : undefined),
      });

      text = await response.text();
    } catch(e) {
      throw this.error(e, {type: 'fetchError', method, url, text, data});
    }

    let json;

    try {
      json = JSON.parse(text);
    } catch(e) {
      throw this.error(e, {type: 'jsonParse', method, url, text, data});
    }

    if (response.status >= 400) {
      throw this.error(
        `server responded ${response.status}`,
        {method, url, text, data},
      );
    }

    json.response = response;


    return json;
  };

  async deleteAll(path) {
    const { event } = this.results;
    const existing = await this.fetch('GET', path)
      .then(all => all.filter(i => i.event === event.id));

    await Promise.all(existing.map(
      l => this.fetch('DELETE', `${this.pathFormat(path)}${l.id}/`)
    ));
  }

  log = (...data) => {
    data.forEach(
      (item) => console.log(`[${this.data.event.name}]`, item)
    );
  };

  error = (e, ...data) => {
    if (!(e instanceof Error)) {
      e = new Error(e);
    }

    e.eventName = this.data.event.name;
    e.data = [
      ...(e.data || []),
      ...data,
    ];
    e.name = 'CamphoricEventCreatorError';

    return e;
  };

  async getAuthToken() {
    if (!this.token) {
      this.token = await getAuthToken();
    }

    return this.token;
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

    // delete existing lodgings associated with this event, so we start clean
    try {
      await this.deleteAll('/api/lodgings/');
    } catch (e) {
      // nothing, we don't care
    }

    const lodgingLookup = this.data.lodgings;
    const lodgingEntries = Object.entries(lodgingLookup);

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
          sharing_multiplier: lodging.sharing_multiplier || 1,
        };
        createdLodging = await this.fetch('POST', '/api/lodgings/', data);

        lodgingLookup[key].id = createdLodging.id;
      } catch (e) {
        if (e.cause?.code !== 'ECONNRESET') {
          throw this.error(e, {type: 'lodgingDataAttempted', key, data, createdLodging});
        } else {
          this.log(`got ECONNRESET on lodging '${key}' (${createLodging.id})`);
        }
      }

      await Promise.all(
        lodgingEntries
          .filter(([, l]) => l.parentKey === key)
          .map(args => createLodging(...args))
      );
    };

    // recursively add all lodgings starting with root
    await createLodging('root', lodgingLookup.root);

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
    const regs = await this.sampleRegGenerator.bind(this)(
      this.fetch,
      this.results,
      this.log,
    );

    if (!Array.isArray(regs)) {
      throw new Error('sample reg generator function returned a non-array');
    }
  }

  async create() {
    await this.organization;
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
      step: 'payment',
      registrationUUID: testData.response.registrationUUID,
      paymentType: testData.formData.payment_type,
      payPalResponse: testData.formData.paypal_response,
    };

    const res = await fetch(`${urlBase}/api/events/${event.id}/register`, {
      method: 'POST',
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
