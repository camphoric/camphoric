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

import LTA from './lta.js';
import BACDS from './bacds.js';
import SFFMC from './sffmc.js';

const organizationsToLoad = [
  BACDS,
  LTA,
  SFFMC,
];

export class Organizations extends Array {
  constructor(orgs) {
    super(...orgs);

    this.byId = {};
    this.byName = {};

    orgs.forEach(org => {
      this.byId[org.id] = org;
      this.byName[org.name] = org;
    });
  }
}


async function loadOrganizations(...args) {
  const orgs = await Promise.all(
    organizationsToLoad.map(values => loadOrganization(values, ...args))
  );

  return new Organizations(orgs);
}

export async function loadOrganization(values, token, urlBase) {
  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());

  // create organization if not exists
  let org = organizations.find(o => o.name === values.organization.name);
  if (!org) {
    console.log(`Could not find '${values.organization.name}' organization, creating`);

    const res = await fetch(`${urlBase}/api/organizations/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify(values.organization),
    });

    if (!res.ok) {
      throw new Error(`error creating organization: ${await res.text()}`);
    }

    org = await res.json();

    const { name } = org;

    console.log(`'${name}' organization created!`);
    console.log(`creating email account for '${name}'`);

  }

  // create email credentials if not exists
  const emailAccounts = await fetch(`${urlBase}/api/emailaccounts/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json());
  let acct = emailAccounts.find(a => a.organization === org.id);
  if (!acct) {
    const creds = {};
    [
      ['username', 'nobody@example.com'],
      ['password', 'abc123'],
      ['name', 'nobody'],
    ].forEach(([field, defaultValue]) => {
      creds[field] = values.emailAccount[field];
      if (!creds[field]) {
        console.warn(`emailAccount.${field} not set for ${org.name}, using default value ${defaultValue}`);
        creds[field] = defaultValue;
      }
    });

    const res = await fetch(`${urlBase}/api/emailaccounts/`, {
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

    if (!res.ok) {
      throw new Error(`error creating email account: ${await res.text()}`);
    }

    acct = await res.json();
  }

  org.email = acct;

  return org;
}


export default loadOrganizations;
