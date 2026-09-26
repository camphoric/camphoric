import camper_schema from './camperSchema.js';
import confirmation_page_template from './confirmationPageTemplate.js';
import pre_submit_template from './preSubmitTemplate.js';
import pricing from './pricing/pricing.js';
import registration_pricing_logic from './pricing/registrationPricingLogic.js';
import camper_pricing_logic from './pricing/camperPricingLogic.js';
import camper_admin_schema from './camperAdminAttributes.js';
import registration_schema from './registrationSchema.js';
import registration_types from './registrationTypes.js';
import registration_ui_schema from './registrationUISchema.js';
import lodgings from './lodgings.js';
import reports from './reports.js';
import makeRegistrations from './testRegistrations.js';
import registration_template_vars from './regTemplateVars.js';
import registration_deposit_schema from './registrationDepositSchema.js';
import registration_admin_schema from './regAdminAttributes.js';
import { dates, lengthInDays, year } from './dates.js';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.js';

export const eventName = `Lark Camp ${year}`;

const data = {
  organization: 'Lark Traditional Arts',
  event: {
    name: eventName,
    // convert dates to strings
    ...Object.entries(dates).reduce((acc, [k, d]) => ({
      ...acc,
      [k]: d.toISO(),
    }), {}),
    default_stay_length: lengthInDays - 1,
    camper_schema,
    camper_admin_schema,
    // payment_schema,
    // If deposit value ends up <= 1, it's considered a percentage
    // otherwise a flat amount
    registration_deposit_schema,
    registration_template_vars,
    registration_schema,
    registration_ui_schema,
    registration_admin_schema,
    // deposit_schema,
    // deposit_schema,
    pricing,
    registration_pricing_logic,
    camper_pricing_logic,
    pre_submit_template,

    confirmation_page_template,
    confirmation_email_template,
    confirmation_email_subject,
    // confirmation_email_from,

  },

  lodgings,
  reports,
  registration_types,
  custom_charge_types: [
    {
      label: 'New Camper Discount',
      name: 'new-camper-discount',
    },
    {
      label: 'New Camper Referer Discount',
      name: 'new-camper-referer-discount',
    },
		{
			label: 'Badge Refund',
			name: 'badge-refund',
		},
		{
			label: 'Other',
			name: 'other',
		},
  ]
};

if (process.env.PAYPAL_CLIENT_ID) {
  data.event.paypal_enabled = true;
  data.event.paypal_client_id = process.env.PAYPAL_CLIENT_ID;
  data.event.epayment_handling = '2.5';
}

const sampleRegGenerator = async (fetch, results) => {
  const regs = makeRegistrations(results.lodging);

  return regs;
};

export default {
  data,
  sampleRegGenerator,
};
