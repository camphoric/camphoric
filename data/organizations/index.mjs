/**
 * Load test organizations
 *
 * Import an organization and add it to the array of organizations to load
 * array if you want to use it during test data import.
 *
 * returns an array of organizations with two additional properties:
 *   byId: a hash lookup of organizations by id
 *   byName: a hash lookup of organizations by name
 */

import LTA from './lta.mjs';

const organizationsToLoad = [
  LTA,
];

export class Organizations extends Array {
  constructor(orgs) {
    this.push(...orgs);
    this.byId = {};
    this.byName = {};

    orgs.forEach(org => {
      this.byId[org.id] = org;
      this.byName[org.name] = org;
    });
  }
};


async function loadOrganizations(...args) {
  const orgs = await Promise.all(
    organizationsToLoad.map(values => loadOrganization(values, ...args))
  );

  return new Organizations(orgs);
}

async function loadOrganization(values, token, urlBase) {
  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());

  let org = organizations.find(o => o.name === values.organization.name);
  if (!org) {
    console.log(`Could not find '${name}' organization, creating`);

    let response = await fetch(`${urlBase}/api/organizations/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify(values.organization),
    });

    if (!response.ok) {
      throw new Error(`error creating organization: ${await response.text()}`);
    }

    org = await response.json();

    const { name } = org;

		console.log(`'${name}' organization created!`);
    console.log(`creating email account for '${name}'`);

    // check email credentials
    const creds = {};
    [
      ['username', 'nobody@example.com'],
      ['password', 'abc123'],
    ].forEach(([field, defaultValue]) => {
      creds[field] = values.emailAccount[field];
      if (!creds[field]) {
        console.warn(`emailAccount.${field} not set for ${name}, using default value ${defaultValue}`);
        creds[field] = defaultValue;
      }
    });

    response = await fetch(`${urlBase}/api/emailaccounts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify({
        organization: org.id,
        ...values.emailAccount,
        ...creds,
      }),
    });

    if (!response.ok) {
      throw new Error(`error creating email account: ${await response.text()}`);
    }

		org.email = await response.json();
  }

  return org;
}


export default loadOrganizations;
