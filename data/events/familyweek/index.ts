import {
  type EventImport,
  type EventModule,
} from 'camphoric-event-import-spec';
import camper_schema from './camperSchema.ts';
import organization from './organization.ts';
import confirmation_page_template from './confirmationPageTemplate.ts';
//import pre_submit_template from './preSubmitTemplate.ts';
import pricing from './pricing/pricing.ts';
import registration_pricing_logic from './pricing/registrationPricingLogic.ts';
import camper_pricing_logic from './pricing/camperPricingLogic.ts';
import registration_schema from './registrationSchema.ts';
import registration_types from './registrationTypes.ts';
import registration_ui_schema from './registrationUISchema.ts';
import registration_deposit_schema from './registrationDepositSchema.ts';
//import lodgings from './lodgings.ts';
import reports from './reports.ts';
// import makeRegistrations from './testRegistrations.ts';
import { dates, lengthInDays, year } from './dates.ts';

import {
  confirmation_email_template,
  confirmation_email_subject,
} from './confirmationEmailTemplate.ts';

export const eventName = `Family Week ${year}`;

const data: EventImport = {
  organization: 'BACDS',
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
    registration_deposit_schema,
    pricing,
    registration_pricing_logic,
    camper_pricing_logic,
    //pre_submit_template,

    confirmation_page_template,
    confirmation_email_template,
    confirmation_email_subject,
    // confirmation_email_from,

  },

  reports,
  registration_types,
};

if (process.env.PAYPAL_CLIENT_ID) {
  data.event.paypal_enabled = true;
  data.event.paypal_client_id = process.env.PAYPAL_CLIENT_ID;
}

//const sampleRegGenerator = async (fetch, results) => {
  //const regs = makeRegistrations(results.lodging);

  //return regs;
//};

export default {
  data,
  organization,
  //sampleRegGenerator,
} satisfies EventModule;
