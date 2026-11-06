/**
 * Import an event into a Camphoric server for its e2e tests.
 */

import { getAuthToken } from './getAuthInfo.ts';
import CamphoricEventCreator from './CamphoricEventCreator.ts';
import { E2E_PAYPAL_CLIENT_ID } from './e2ePayPal.ts';
import { Organizations, organizationLoader } from './organizations.ts';
import type { ImportableEvent } from './types.ts';

export interface ImportForE2EOptions {
  // The event module's default export
  event: ImportableEvent;
  // The spec's validateEventImport
  validate: (data: unknown) => unknown[];
  url: string;
  username: string;
  password: string;
  // Also post its sample registrations (default: no, a form with no data)
  withSampleRegistrations?: boolean;
  // Open its registration window now, whatever its dates say (default: yes),
  // so the form can be tested on any day (otherwise, outside its window,
  // the page says registration is closed and shows no form). Its other dates
  // are unchanged.
  openRegistration?: boolean;
  // Take payments online (default: no, unless the event's data does): PayPal
  // is enabled with a client id only the fake PayPal accepts, so the payment
  // step offers PayPal's buttons and adds the event's e-payment handling.
  // Only for a throwaway server, whose PayPal is the fake (setUpEvent refuses
  // it for an existing one).
  onlinePayment?: boolean;
}

/** Imports the event (and creates its organization), returning its id. */
export async function importForE2E(options: ImportForE2EOptions): Promise<number> {
  const {
    event, validate, url, username, password, withSampleRegistrations = false, openRegistration = true,
    onlinePayment = false,
  } = options;
  // The fetcher logs in with these
  process.env.DJANGO_SUPERUSER_USERNAME = username;
  process.env.DJANGO_SUPERUSER_PASSWORD = password;

  // Imported with the window open, so its sample registrations (posted as
  // it's imported) are accepted, and set again afterwards, in case an
  // override changed it
  const day = 24 * 60 * 60 * 1000;
  const window = {
    registration_start: new Date(Date.now() - day).toISOString(),
    registration_end: new Date(Date.now() + 365 * day).toISOString(),
  };
  const payPal = { paypal_enabled: true, paypal_client_id: E2E_PAYPAL_CLIENT_ID };
  // Set again afterwards too, like the window
  const changes = { ...(openRegistration ? window : {}), ...(onlinePayment ? payPal : {}) };
  const data = { ...event.data, event: { ...event.data.event, ...changes } };

  const token = await getAuthToken(url);
  const organization = await organizationLoader(token, url)(event.organization);
  const creator = new CamphoricEventCreator({
    data,
    validate,
    overrides: event.overrides,
    sampleRegGenerator: withSampleRegistrations ? event.sampleRegGenerator : undefined,
    organizations: new Organizations([organization]),
    url,
  });
  await creator.create();
  const { id } = creator.savedEvent();
  if (Object.keys(changes).length) await creator.fetch('PATCH', `/api/events/${id}/`, changes);

  return id;
}
