import {
  savedLodging,
  type EventImport,
  type EventModule,
  type Override,
  type SampleRegGenerator,
} from '../eventImportObjectSchema.ts';
import camper_schema from './camperSchema.ts';
import confirmation_page_template from './confirmationPageTemplate.ts';
import pre_submit_template from './preSubmitTemplate.ts';
import pricing from './pricing/pricing.ts';
import registration_pricing_logic from './pricing/registrationPricingLogic.ts';
import camper_pricing_logic_fn from './pricing/camperPricingLogic.ts';
import registration_schema from './registrationSchema.ts';
import registration_types from './registrationTypes.ts';
import registration_ui_schema from './registrationUISchema.ts';
import registration_error_messages from './registrationErrorMessages.ts';
import lodgings from './lodgings.ts';
import reports from './reports.ts';
import makeRegistrations from './testRegistrations.ts';
import { dates, lengthInDays, yearDisplay } from './dates.ts';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.ts';

export const eventName = `Camp Harmony ${yearDisplay}`;

const data: EventImport = {
  organization: 'SFFMC',
  event: {
    name: eventName,
    // convert dates to strings
    ...Object.entries(dates).reduce((acc, [k, d]) => ({
      ...acc,
      [k]: d.toISO(),
    }), {}),
    default_stay_length: lengthInDays,
    camper_schema,
    // payment_schema,
    registration_schema,
    registration_ui_schema,
    registration_error_messages,
    // registration_admin_schema,
    // deposit_schema,
    // deposit_schema,
    pricing,
    registration_pricing_logic,
    // camper_pricing_logic,
    pre_submit_template,

    confirmation_page_template,
    confirmation_email_template,
    confirmation_email_subject,
    // confirmation_email_from,

  },

  lodgings,
  reports,
  registration_types,
};

if (process.env.PAYPAL_CLIENT_ID) {
  data.event.paypal_enabled = true;
  data.event.paypal_client_id = process.env.PAYPAL_CLIENT_ID;
}

// We override pricing because we need to get the lodging ids in order to get
// the pricing correct
const pricingOverride: Override = async (fetch, results) => {
  const camper_pricing_logic = camper_pricing_logic_fn(savedLodging(results));

  await fetch('PATCH', `/api/events/${results.event.id}/`, {
    camper_pricing_logic,
  });
};

const sampleRegGenerator: SampleRegGenerator = async (_fetch, results) => {
  const regs = makeRegistrations(savedLodging(results));

  return regs;
};

export default {
  data,
  sampleRegGenerator,
  overrides: [
    pricingOverride
  ],
} satisfies EventModule;
