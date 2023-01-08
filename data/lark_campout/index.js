import camper_schema from './camperSchema.js';
import confirmation_page_template from './confirmationPageTemplate.js';
import pre_submit_template from './preSubmitTemplate.js';
import pricing from './pricing/pricing.js';
import registration_pricing_logic from './pricing/registrationPricingLogic.js';
import registration_schema from './registrationSchema.js';
import registration_types from './registrationTypes.js';
import registration_ui_schema from './registrationUISchema.js';
import lodgings from './lodgings.js';
import reports from './reports.js';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.js';

const lengthInDays = 5;
const startDate = new Date();
startDate.setFullYear(startDate.getFullYear() + 1);
startDate.setUTCHours(startDate.getUTCHours() + (30 * 24));

const dates = {
  registration_start: new Date(),
  registration_end: new Date(startDate),
  start: startDate,
  end: new Date(startDate),
};

dates.registration_end.setUTCMonth(startDate.getUTCMonth() - 1);
dates.end.setUTCHours(startDate.getUTCHours() + (lengthInDays * 24));


const data = {
  organization: 'Lark Traditional Arts',
  event: {
    name: `Lark Campout ${startDate.getFullYear()}`,
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
    // pricing,
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

export default {
  data,
  // sampleRegGenerator,
  // overrides,
};
