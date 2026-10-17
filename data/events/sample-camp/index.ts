/**
 * Sample Camp: a made-up event that uses as much of the import contract as
 * it can, as an example of an event module and a test of importing every
 * feature. It names no real camp, organization, place or person. It stays in
 * this repository (the real camps are packages of their own) and is never
 * published.
 */

import {
  savedLodging,
  type EventImport,
  type EventModule,
  type Override,
  type SampleRegGenerator,
} from '@camphoric/camphoric-event-import-spec';

import { camper_admin_schema, registration_admin_schema } from './adminSchemas.ts';
import camper_schema from './camperSchema.ts';
import {
  confirmation_email_from,
  confirmation_email_subject,
  confirmation_email_template,
} from './confirmationEmailTemplate.ts';
import confirmation_page_template from './confirmationPageTemplate.ts';
import { dates, lengthInDays, year, zone } from './dates.ts';
import lodgings from './lodgings.ts';
import organization from './organization.ts';
import camperPricingLogic, { placeholder as camper_pricing_logic } from './pricing/camperPricingLogic.ts';
import pricing from './pricing/pricing.ts';
import registration_pricing_logic from './pricing/registrationPricingLogic.ts';
import pre_submit_template from './preSubmitTemplate.ts';
import registration_deposit_schema from './registrationDepositSchema.ts';
import registration_error_messages from './registrationErrorMessages.ts';
import registration_schema from './registrationSchema.ts';
import registration_types from './registrationTypes.ts';
import registration_ui_schema from './registrationUISchema.ts';
import reports from './reports.ts';
import registration_template_vars from './templateVars.ts';
import makeRegistrations from './testRegistrations.ts';

export const eventName = `Sample Camp ${year}`;

const data: EventImport = {
  organization: organization.organization.name,
  event: {
    name: eventName,
    registration_start: dates.registration_start.toISO()!,
    registration_end: dates.registration_end.toISO()!,
    start: dates.start.toISO()!,
    end: dates.end.toISO()!,
    time_zone: zone,
    default_stay_length: lengthInDays,
    camper_schema,
    camper_admin_schema,
    // the attributes of a payment and of a bank deposit, as organizers record them
    payment_schema: {
      properties: { check_number: { type: 'string', title: 'Check number', maxLength: 20 } },
    },
    deposit_schema: {
      properties: { bank_reference: { type: 'string', title: 'Bank reference', maxLength: 40 } },
    },
    registration_deposit_schema,
    registration_template_vars,
    registration_schema,
    registration_ui_schema,
    registration_error_messages,
    registration_admin_schema,
    pricing,
    registration_pricing_logic,
    camper_pricing_logic,
    epayment_handling: '2.5',
    pre_submit_template,
    confirmation_page_template,
    confirmation_email_subject,
    confirmation_email_template,
    confirmation_email_from,
  },
  lodgings,
  reports,
  custom_charge_types: [
    { name: 'scholarship', label: 'Scholarship' },
    { name: 'other', label: 'Other' },
  ],
  registration_types,
};

// Online payments, only where a PayPal client is configured
if (process.env.PAYPAL_CLIENT_ID) {
  data.event.paypal_enabled = true;
  data.event.paypal_client_id = process.env.PAYPAL_CLIENT_ID;
}

// The camper pricing names lodging by id, which only exists once the lodging
// is saved, so it's set after the import
const pricingOverride: Override = async (fetch, results) => {
  await fetch('PATCH', `/api/events/${results.event.id}/`, {
    camper_pricing_logic: camperPricingLogic(savedLodging(results)),
  });
};

const sampleRegGenerator: SampleRegGenerator = async (_fetch, results) => (
  makeRegistrations(savedLodging(results))
);

export default {
  data,
  organization,
  sampleRegGenerator,
  overrides: [pricingOverride],
} satisfies EventModule;
