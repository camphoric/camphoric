import type { RegistrationType } from '@camphoric/camphoric-event-import-spec';

// A registration type, before its invitation email is added
type RegTypeBase = Omit<RegistrationType, 'invitation_email_subject' | 'invitation_email_template'>;

import { yearDisplay } from './dates.ts';

const emails: Record<string, (regType: RegTypeBase) => string> = {
  'late-registrant': () => `
Dear {{ invitation.recipient_name or invitation.recipient_email }},

You have been invited to register late to Camp Harmony ${yearDisplay}!

[Please click here to register!]({{ invitation.register_url }})

Questions? Email us at [campnewharmony@gmail.com](mailto:campnewharmony@gmail.com)
(preferred) or call [415-987-0502](tel:415-987-0502). Be patient, we are volunteers.

All the best,

The Camp Harmony Registrar
`,
};

const specialType = (regType: RegTypeBase): RegistrationType => ({
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
