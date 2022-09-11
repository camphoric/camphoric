#!/usr/bin/env node --no-warnings

/**
 * Import test lark data
 *
 * The following env vars can be set if needed.  If both
 * CAMPHORIC_SUPERUSER_USERNAME and CAMPHORIC_SUPERUSER_PASSWORD is set, this
 * script will run without prompts
 *
 * - CAMPHORIC_URL = base url for your installation.  This defaults to the url
 *   for the docker compose setup
 * - CAMPHORIC_TEST_EVENT_NAME = the name of the event to check for and add or
 *   overwrite it.
 * - DJANGO_SUPERUSER_USERNAME = the django superuser's username
 * - DJANGO_SUPERUSER_PASSWORD = the django superuser's password
 */

import fetch from 'node-fetch';
import inquirer from 'inquirer';

import createTestRegs from './testRegistrations.mjs';
import camperPricingLogic from './pricing/camperPricingLogic.mjs';
import reports from './reports.mjs';
import { getAuthToken } from '../getAuthInfo.mjs';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';
const eventName = 'Lark Campout 2022';

const eventAttributes = {
  camper_schema: (await import('./camperSchema.mjs')).default,
  confirmation_page_template: (await import('./confirmationPageTemplate.mjs')).default,
  pre_submit_template: (await import('./preSubmitTemplate.mjs')).default,
  pricing: (await import('./pricing/pricing.mjs')).default,
  registration_pricing_logic: (await import('./pricing/registrationPricingLogic.mjs')).default,
  registration_schema: (await import('./registrationSchema.mjs')).default,
  registration_types: (await import('./registrationTypes.mjs')).default,
  registration_ui_schema: (await import('./registrationUISchema.mjs')).default,
  lodgings: (await import('./lodgings.mjs')).default,
  ...(await import('./confirmationEmailTemplate.mjs')).default,
};

if (process.env.PAYPAL_CLIENT_ID) {
  eventAttributes.paypal_enabled = true;
  eventAttributes.paypal_client_id = process.env.PAYPAL_CLIENT_ID;
}

const lodgingIdLookup = {};

async function main(authToken) {
  let token = authToken;
  if (!token) {
    const token = await getAuthToken();
  }

  const org = await loadOrganization(token);
  console.log('Processed organization');
  // console.log(org);

  const evt = await loadEvent(token, org);
  console.log(`Processed event '${eventName}'`);
  // console.log(evt);

  await loadLodgings(token, evt);
  console.log('Processed event lodging');

  await loadCamperPricing(token, evt);
  console.log('Processed camper pricing');

  await loadReports(token, evt);
  console.log('Processed reports');

  await loadRegTypes(token, evt);
  console.log('Processed event registration types');

  await loadTestRegs(token, evt);
  console.log('Processed test registrations');

  console.log('Finished!');
  return true;
}

async function loadOrganization(token) {
  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());

  let org = organizations.find(o => o.name === "Lark Traditional Arts");

  if (!org) {
    throw new Error(`did not find org '${name}' for event '${eventName}'`);
  }

  return org;
}

async function loadEvent(token, org) {
  let response = await fetch(`${urlBase}/api/events/`, {
    headers: { 'Authorization': `Token ${token}` },
  });

  const events = await response.json();
  const existingEvent = events.find(event => event.name === eventName);
  const emailAccounts = await fetch(`${urlBase}/api/emailaccounts/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());
  const email = emailAccounts.find(e => e.organization === org.id);


  const event = {
    organization: org.id,
    name: eventName,
    confirmation_email_from: email.username,
    email_account: email.id,

    ...eventAttributes,
    camper_pricing_logic: [],
  };

  if (existingEvent) {
    event.id = existingEvent.id;
  }

  let text, json;
  try {
    response = await fetch(`${urlBase}/api/events/${existingEvent ? `${event.id}/` : ''}`, {
      method: existingEvent ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    text = await response.text();

    json = JSON.parse(text);
  } catch(e) {
    console.error(e, text);
  }

  return json;
}

async function loadLodgings(token, event) {
  // delete existing lodgings
  let response = await fetch(`${urlBase}/api/lodgings/`, {
    method: 'GET',
    headers: { 'Authorization': `Token ${token}` },
  });
  const existingLodgings = (await response.json())
    .filter(lodging => lodging.event === event.id);
  for (let lodging of existingLodgings) {
    response = await fetch(`${urlBase}/api/lodgings/${lodging.id}/`, {
      method: 'DELETE',
      headers: { 'Authorization': `Token ${token}` }
    });
  }

  for (let [key, lodging] of Object.entries(eventAttributes.lodgings)) {
    response = await fetch(`${urlBase}/api/lodgings/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: event.id,
        parent: lodging.parentKey ? lodgingIdLookup[lodging.parentKey] : null,
        name: lodging.name,
        children_title: lodging.children_title,
        visible: lodging.visible,
        capacity: lodging.capacity || 0,
        sharing_multiplier: lodging.sharing_multiplier || 1,
      }),
    });
    const createdLodging = await response.json();
    lodgingIdLookup[key] = createdLodging.id;
  }
}

async function loadReports(token, event) {
  const postReport = async (report) => {
    let text;
    try {
      const response = await fetch(`${urlBase}/api/reports/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...report,
          event: event.id,
        }),
      });
      text = await response.text();

      const json = JSON.parse(text);
    } catch(e) {
      console.error(e, text);
    }
  };

  await Promise.all(reports.map(postReport));
}

async function loadCamperPricing(token, event) {
  // delete existing lodgings
  let response = await fetch(`${urlBase}/api/lodgings/`, {
    method: 'GET',
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());

  const offSiteItem = response
    .filter(lodging => lodging.event === event.id)
    .find(lodging => lodging.name === 'Off Site');

  response = await fetch(`${urlBase}/api/events/${event.id}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event: event.id,
      camper_pricing_logic: camperPricingLogic(offSiteItem.id)
    }),
  });
}

async function loadRegTypes(token, event) {
  // delete existing lodgings
  let response = await fetch(`${urlBase}/api/registrationtypes/`, {
    method: 'GET',
    headers: { 'Authorization': `Token ${token}` },
  });

  const existingRegTypes = (await response.json())
    .filter(regType => regType.event === event.id);

  await Promise.all(
    eventAttributes.registration_types.map(
      async (regType) => {
        const exists = existingRegTypes.find(r => r.name === regType.name);

        if (exists) {
          regType.id = exists.id;
        }

        regType.event = event.id

        let text, json;
        try {
          response = await fetch(`${urlBase}/api/registrationtypes/${exists ? `${regType.id}/` : ''}`, {
            method: exists ? 'PUT' : 'POST',
            headers: {
              'Authorization': `Token ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(regType),
          });
          text = await response.text();

          json = JSON.parse(text);
        } catch(e) {
          console.error(e, text);
        }
      }
    )
  );
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

    try {
      const json = JSON.parse(text);
    } catch (e) {
      console.log('failed to add test reg, see Django logs');
    }

    return text;
  }

  const registrations = createTestRegs(lodgingIdLookup);

  const responses = await Promise.all(
    registrations.map(postReg)
  );

  // console.log(responses);
}


export default main;

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
