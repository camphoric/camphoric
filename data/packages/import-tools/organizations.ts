/**
 * Load the organizations the events declare (each event module's
 * `organization`), creating any the server doesn't have, with its email
 * account.
 *
 * Organizations is an array of organizations with two additional properties:
 *   byId: a hash lookup of organizations by id
 *   byName: a hash lookup of organizations by name
 */

import lodash from 'lodash';
import type { OrganizationImport } from './types.ts';

/** An organization as the server returned it, with its email account. */
export type Organization = {
  id: number,
  name: string,
  email?: Record<string, unknown>,
} & Record<string, unknown>;

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


/**
 * A loader that loads each organization once, by name, however many events
 * declare it (Lark Camp and the Jughandle Campout share one). When two events
 * declare the same name differently, the first declaration wins.
 */
export function organizationLoader(token: string, urlBase: string) {
  const loaded = new Map<string, { values: OrganizationImport, org: Promise<Organization> }>();

  return (values: OrganizationImport): Promise<Organization> => {
    const { name } = values.organization;
    const existing = loaded.get(name);

    if (existing) {
      if (!lodash.isEqual(existing.values, values)) {
        console.warn(`organization '${name}' is declared differently by two events; using the first`);
      }

      return existing.org;
    }

    const org = loadOrganization(values, token, urlBase);
    loaded.set(name, { values, org });

    return org;
  };
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
