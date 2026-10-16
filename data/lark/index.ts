import {
  savedLodging,
  type EventImport,
  type EventModule,
  type SampleRegGenerator,
} from '../eventImportObjectSchema.ts';
import camper_schema from './camperSchema.ts';
import confirmation_page_template from './confirmationPageTemplate.ts';
import pre_submit_template from './preSubmitTemplate.ts';
import pricing from './pricing/pricing.ts';
import registration_pricing_logic from './pricing/registrationPricingLogic.ts';
import camper_pricing_logic from './pricing/camperPricingLogic.ts';
import camper_admin_schema from './camperAdminAttributes.ts';
import registration_schema from './registrationSchema.ts';
import registration_types from './registrationTypes.ts';
import registration_ui_schema from './registrationUISchema.ts';
import lodgings from './lodgings.ts';
import reports from './reports.ts';
import makeRegistrations from './testRegistrations.ts';
import registration_template_vars from './regTemplateVars.ts';
import registration_deposit_schema from './registrationDepositSchema.ts';
import registration_admin_schema from './regAdminAttributes.ts';
import { dates, lengthInDays, year } from './dates.ts';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.ts';

export const eventName = `Lark Camp ${year}`;

const data: EventImport = {
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

const sampleRegGenerator: SampleRegGenerator = async (_fetch, results) => {
  const regs = makeRegistrations(savedLodging(results));

  return regs;
};

export default {
  data,
  sampleRegGenerator,
} satisfies EventModule;
