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

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';
const eventName = process.env.CAMPHORIC_TEST_EVENT_NAME || 'Lark Campout 2022';

const eventAttributes = {
  camper_schema: (await import('./camperSchema.mjs')).default,
  confirmation_page_template: (await import('./confirmationPageTemplate.mjs')).default,
  pricing: (await import('./pricing/pricing.mjs')).default,
  registration_pricing_logic: (await import('./pricing/registrationPricingLogic.mjs')).default,
  registration_schema: (await import('./registrationSchema.mjs')).default,
  registration_types: (await import('./registrationTypes.mjs')).default,
  registration_ui_schema: (await import('./registrationUISchema.mjs')).default,
  lodgings: (await import('./lodgings.mjs')).default,
  ...(await import('./confirmationEmailTemplate.mjs')).default,
};

const lodgingIdLookup = {};

async function main() {
  const creds = await getAuthToken();
  console.log('logged in');

  const org = await loadOrganization(creds);
	console.log('Processed organization');
  // console.log(org);

  const evt = await loadEvent(creds, org);
	console.log(`Processed event '${eventName}'`);
  // console.log(evt);

  await loadLodgings(creds, evt);
	console.log('Processed event lodging');

  await loadCamperPricing(creds, evt);
  console.log('Processed camper pricing');

  await loadRegTypes(creds, evt);
  console.log('Processed event registration types');

  await loadTestRegs(creds, evt);
  console.log('Processed test registrations');

	console.log('Finished!');
  return true;
}

function extractCookieString(response) {
  return response.headers.raw()['set-cookie'].map(
    c => {
      const m = c.match(/^([^=]+=[^;]+)/);

      return m[1];
    }
  ).join('; ');
}

async function getAuthToken() {
	let username = process.env.DJANGO_SUPERUSER_USERNAME;
	let password = process.env.DJANGO_SUPERUSER_PASSWORD;

	if (!username && !password) {
		const answers = await inquirer.prompt([
			{ name: 'username' },
			{ name: 'password', type: 'password' },
		]);

		username = answers.username;
		password = answers.password;
	}

  let response;
  let cookies;
  let match;
  let csrf;
  response = await fetch(`${urlBase}/api/set-csrf-cookie`);
  cookies = response.headers.raw()['set-cookie'];
  match = cookies[0].match(/\bcsrftoken=([^;]+)/);
  csrf = (match && match[1]) || '';

  response = await fetch(`${urlBase}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
      cookie: `csrftoken=${csrf}`,
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  console.log(response.status);

  const cookie = extractCookieString(response);
  cookies = response.headers.raw()['set-cookie'];
  match = cookies[0].match(/\bcsrftoken=([^;]+)/);
  csrf = (match && match[1]) || '';

  return {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrf,
    cookie,
  };
}


async function loadOrganization(creds) {
  console.log(creds);

  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: creds,
  }).then(r => r.json());

  console.log(organizations);

  let org = organizations.find(o => o.name === "Lark Traditional Arts");
  if (!org) {
    console.log('Could not find Lark Traditional Arts, creating');
    const response = await fetch(`${urlBase}/api/organizations/`, {
      method: 'POST',
      headers: creds,
      body: JSON.stringify({
        name: "Lark Traditional Arts"
      }),
    });

    org = await response.json();
		console.log('Lark Traditional Arts organization created!');
  }

  return org;
}

async function loadEvent(creds, org) {
  let response = await fetch(`${urlBase}/api/events/`, {
    headers: creds,
  });

  const events = await response.json();
  const existingEvent = events.find(event => event.name === eventName);

  const event = {
    organization: org.id,
    name: eventName,
    confirmation_email_from: 'registration@larkcamp.org',
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
      headers: creds,
      body: JSON.stringify(event),
    });
    text = await response.text();

    json = JSON.parse(text);
  } catch(e) {
    console.error(e, text);
  }

  return json;
}

async function loadLodgings(creds, event) {
  // delete existing lodgings
  let response = await fetch(`${urlBase}/api/lodgings/`, {
      method: 'GET',
      headers: creds,
  });

  const existingLodgings = (await response.json())
    .filter(lodging => lodging.event === event.id);
  for (let lodging of existingLodgings) {
    response = await fetch(`${urlBase}/api/lodgings/${lodging.id}/`, {
      method: 'DELETE',
      headers: creds
    });
  }

  const loadLodgings = async (parent, parentKey) => {
    const promises = [];

    for (let [key, lodging] of Object.entries(eventAttributes.lodgings)) {
      if (lodging.parentKey !== parentKey) continue;

      const createdLodging = await fetch(`${urlBase}/api/lodgings/`, {
        method: 'POST',
        headers: creds,
        body: JSON.stringify({
          event: event.id,
          parent: parent.id,
          name: lodging.name,
          children_title: lodging.children_title,
          visible: lodging.visible,
          capacity: lodging.capacity || 0,
          sharing_multiplier: lodging.sharing_multiplier || 1,
        }),
      }).then(r => r.json());

      promises.push(loadLodgings(createdLodging, key));
    }

    await Promise.all(promises);
  }

  const rootData = eventAttributes.lodgings.root;
  const root = await fetch(`${urlBase}/api/lodgings/`, {
    method: 'POST',
    headers: creds,
    body: JSON.stringify({
      event: event.id,
      parent: null,
      name: rootData.name,
      children_title: rootData.children_title,
      visible: rootData.visible,
      capacity: rootData.capacity || 0,
      sharing_multiplier: rootData.sharing_multiplier || 1,
    }),
  }).then(r => r.json());

  await loadLodgings(root, 'root');
}

async function loadCamperPricing(creds, event) {
  // delete existing lodgings
  let response = await fetch(`${urlBase}/api/lodgings/`, {
      method: 'GET',
      headers: creds,
  }).then(r => r.json());

  const offSiteItem = response
    .filter(lodging => lodging.event === event.id)
    .find(lodging => lodging.name === 'Off Site');

  response = await fetch(`${urlBase}/api/events/${event.id}/`, {
    method: 'PATCH',
    headers: creds,
    body: JSON.stringify({
      event: event.id,
      camper_pricing_logic: camperPricingLogic(offSiteItem.id)
    }),
  });
}

async function loadRegTypes(creds, event) {
  // delete existing lodgings
  let response = await fetch(`${urlBase}/api/registrationtypes/`, {
      method: 'GET',
      headers: creds,
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
            headers: creds,
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

async function loadTestRegs(creds, event) {

  const postReg = async (testData) => {
    const res = await fetch(`${urlBase}/api/events/${event.id}/register`, {
      method: "POST",
      headers: creds,
      body: JSON.stringify(testData),
    });

    return res.text();
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
