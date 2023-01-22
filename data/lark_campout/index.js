import camper_schema from './camperSchema.js';
import confirmation_page_template from './confirmationPageTemplate.js';
import pre_submit_template from './preSubmitTemplate.js';
import pricing from './pricing/pricing.js';
import registration_pricing_logic from './pricing/registrationPricingLogic.js';
import camper_pricing_logic_fn from './pricing/camperPricingLogic.js';
import registration_schema from './registrationSchema.js';
import registration_types from './registrationTypes.js';
import registration_ui_schema from './registrationUISchema.js';
import lodgings from './lodgings.js';
import reports from './reports.js';
import makeRegistrations from './testRegistrations.js';
import { dates, lengthInDays, year } from './dates.js';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.js';

export const eventName = `Lark Campout ${year}`;

const data = {
  organization: 'Lark Traditional Arts',
  event: {
    name: eventName,
    // convert dates to strings
    ...Object.entries(dates).reduce((acc, [k, d]) => ({
      ...acc,
      [k]: d.toISOString(),
    }), {}),
    default_stay_length: lengthInDays,
    camper_schema,
    // payment_schema,
    registration_schema,
    registration_ui_schema,
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

// We override pricing because we need to get the off_site id in order to get
// the pricing correct
const pricingOverride = async (fetch, results) => {
  const offsiteId = results.lodging.off_site.id;
  const camper_pricing_logic = camper_pricing_logic_fn(offsiteId);

  await fetch('PATCH', `/api/events/${results.event.id}/`, {
    camper_pricing_logic,
  });
};

const sampleRegGenerator = async (fetch, results) => {
  const regs = makeRegistrations(results.lodging);

  return regs;
};

export default {
  data,
  sampleRegGenerator,
  overrides: [
    pricingOverride
  ],
};
