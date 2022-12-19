import CamphoricEventCreator from '../loadEvent.mjs';

import camper_schema from './camperSchema.mjs';
import confirmation_page_template from './confirmationPageTemplate.mjs';
import pre_submit_template from './preSubmitTemplate.mjs';
import pricing from './pricing/pricing.mjs';
import registration_pricing_logic from './pricing/registrationPricingLogic.mjs';
import registration_schema from './registrationSchema.mjs';
import registration_types from './registrationTypes.mjs';
import registration_ui_schema from './registrationUISchema.mjs';
import lodgings from './lodgings.mjs';
import reports from './reports.mjs';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.mjs';

const startDate = new Date();
startDate.setUTCYear(startDate.getFullYear() + 1);
startDate.setUTCHours(startDate.getUTCHours() + (30 * 24))

const lengthInDays = 5;

const data = {
  organization: 'Lark Traditional Arts',
  event: {
    name: `Lark Campout ${data.getFullYear()}`,
    registration_start: new Date().toISOString(),
    registration_end: new Date(startDate)
      .setUTCMonth(startDate.getUTCMonth() - 1)
      .toISOString(),
    start: startDate.toISOString(),
    end: new Date(startDate)
      .setUTCHours(startDate.getUTCHours() + (lengthInDays * 24))
      .toISOString(),
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

export {
  data,
  // sampleRegGenerator,
  // overrides,
};
