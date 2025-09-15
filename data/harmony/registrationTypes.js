import { yearDisplay } from './dates.js';

const emails = {
  'late-registrant': () => `
Dear {{recipient_name}},

You have been invited to register late to Camp Harmony ${yearDisplay}!

[Please click here to register!]({{register_link}})

Questions? Email us at [campnewharmony@gmail.com](mailto:campnewharmony@gmail.com)
(preferred) or call [415-987-0502](tel:415-987-0502). Be patient, we are volunteers.

All the best,

The Camp Harmony Registrar
`,
};

const specialType = (regType) => ({
  ...regType,
  invitation_email_subject: `Register for ${regType.label}`,
  invitation_email_template:
    emails[regType.name]
      ? emails[regType.name](regType)
      : 'test email',
});

export default [
  { name: 'late-registrant', label: 'Late Registrant' },
].map(specialType);
