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
 * - CAMPHORIC_SUPERUSER_USERNAME = the django superuser's username
 * - CAMPHORIC_SUPERUSER_PASSWORD = the django superuser's password
 */

import fetch from 'node-fetch';
import inquirer from 'inquirer';

const urlBase = process.env.CAMPHORIC_URL || 'http://django:8000';
const eventName = process.env.CAMPHORIC_TEST_EVENT_NAME || 'Lark 2022';

const modules = {
  camper_pricing_logic: (await import('./camperPricingLogic.mjs')).default,
  camper_schema: (await import('./camperSchema.mjs')).default,
  confirmation_page_template: (await import('./confirmationPageTemplate.mjs')).default,
  pricing: (await import('./pricing.mjs')).default,
  registration_pricing_logic: (await import('./registrationPricingLogic.mjs')).default,
  registration_schema: (await import('./registrationSchema.mjs')).default,
  registration_ui_schema: (await import('./registrationUISchema.mjs')).default,
  lodgings: (await import('./lodgings.mjs')).default,
};

async function main() {
  const token = await getAuthToken();
  // console.log(token);

  const org = await loadOrganization(token);
	console.log('Processed organization');
  // console.log(org);

  const evt = await loadEvent(token, org);
	console.log(`Processed event '${eventName}'`);
  // console.log(evt);

  await loadLodgings(token, evt);
	console.log('Processed event lodging');

	console.log('Finished!');
  return true;
}


async function getAuthToken() {
	let username = process.env.CAMPHORIC_SUPERUSER_USERNAME;
	let password = process.env.CAMPHORIC_SUPERUSER_PASSWORD;

	if (!username && !password) {
		const answers = await inquirer.prompt([
			{ name: 'username' },
			{ name: 'password', type: 'password' },
		]);

		username = answers.username;
		password = answers.password;
	}

  const response = await fetch(`${urlBase}/api-token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${username}&password=${password}`,
  });
  const json = await response.json();
  const { token } = json;
  if (!token) {
    throw new Error(JSON.stringify(json));
  }

  return token;
}


async function loadOrganization(token) {
  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());
  
  let org = organizations.find(o => o.name === "Lark Traditional Arts");
  if (!org) {
    console.log('Could not find Lark Traditional Arts, creating');
    org = await fetch(`${urlBase}/api/organizations/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`, 
      },
      body: JSON.stringify({
        name: "Lark Traditional Arts"
      }),
    }).then(res => res.json());

		console.log('Lark Traditional Arts organization created!');
  }

  return org;
}

async function loadEvent(token, org) {
  let response = await fetch(`${urlBase}/api/events/`, {
    headers: { 'Authorization': `Token ${token}` },
  });
  
  const events = await response.json();
  const existingEvent = events.find(event => event.name === eventName);
  
  const event = {
    organization: org.id,
    name: eventName,
    confirmation_email_from: 'registration@larkcamp.org',
    ...modules,
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

  // create new lodgings
  const idLookup = {};
  for (let [key, lodging] of Object.entries(modules.lodgings)) {
    response = await fetch(`${urlBase}/api/lodgings/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: event.id,
        parent: lodging.parentKey ? idLookup[lodging.parentKey] : null,
        name: lodging.name,
        children_title: lodging.children_title,
        visible: lodging.visible,
        capacity: lodging.capacity || 0,
      }),
    });
    const createdLodging = await response.json();
    idLookup[key] = createdLodging.id;
  }
}

export default main;

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
