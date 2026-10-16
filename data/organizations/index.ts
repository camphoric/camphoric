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

import LTA from './lta.ts';
import BACDS from './bacds.ts';
import SFFMC from './sffmc.ts';

/** An organization to create, with the email account it sends from. */
export interface OrganizationImport {
  organization: { name: string };
  emailAccount: {
    name?: string,
    backend?: string,
    host?: string,
    port?: string,
    username?: string,
    password?: string,
  };
}

/** An organization as the server returned it, with its email account. */
export type Organization = {
  id: number,
  name: string,
  email?: Record<string, unknown>,
} & Record<string, unknown>;

const organizationsToLoad: OrganizationImport[] = [
  BACDS,
  LTA,
  SFFMC,
];

export class Organizations extends Array<Organization> {
  byId: Record<string, Organization>;
  byName: Record<string, Organization>;

  constructor(orgs: Organization[]) {
    super(...orgs);

    this.byId = {};
    this.byName = {};

    orgs.forEach(org => {
      this.byId[org.id] = org;
      this.byName[org.name] = org;
    });
  }
}


async function loadOrganizations(token: string, urlBase: string): Promise<Organizations> {
  const orgs = await Promise.all(
    organizationsToLoad.map(values => loadOrganization(values, token, urlBase))
  );

  return new Organizations(orgs);
}

export async function loadOrganization(
  values: OrganizationImport,
  token: string,
  urlBase: string,
): Promise<Organization> {
  const organizations = await fetch(`${urlBase}/api/organizations/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json() as Promise<Organization[]>);

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

    org = await res.json() as Organization;

    const { name } = org;

    console.log(`'${name}' organization created!`);
    console.log(`creating email account for '${name}'`);

  }

  // create email credentials if not exists
  const emailAccounts = await fetch(`${urlBase}/api/emailaccounts/`, {
    headers: { 'Authorization': `Token ${token}` },
  }).then(r => r.json() as Promise<Record<string, unknown>[]>);
  let acct = emailAccounts.find(a => a.organization === org.id);
  if (!acct) {
    const creds: Record<string, string | undefined> = {};
    ([
      ['username', 'nobody@example.com'],
      ['password', 'abc123'],
      ['name', 'nobody'],
    ] as const).forEach(([field, defaultValue]) => {
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

    acct = await res.json() as Record<string, unknown>;
  }

  org.email = acct;

  return org;
}


export default loadOrganizations;
