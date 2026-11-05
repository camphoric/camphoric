import type { RegistrationType } from '@camphoric/camphoric-event-import-spec';

// Invitation emails are Jinja (SPEC §8.4): `invitation` (recipient_name,
// recipient_email, code, register_url), `registration_type` and `event`.
const invitation = (role: string) => `
Hello {{ invitation.recipient_name or invitation.recipient_email }},

You're invited to register for {{ event.name }} as ${role}.

[Register here]({{ invitation.register_url }})

The Sample Camp team
`;

export default [
  {
    name: 'staff',
    label: 'Staff',
    invitation_email_subject: 'Register as Sample Camp staff',
    invitation_email_template: invitation('staff'),
    invitation_email_from: 'staff@example.com',
    invitation_email_reply_to: 'staff@example.com',
    // Staff register one person at a time, are told they arrive early, and
    // are prompted for their role in the comments
    registration_schema_overrides: { properties: { campers: { maxItems: 1 } } },
    camper_schema_overrides: { properties: { arrival: { description: 'Staff arrive two days before camp.' } } },
    ui_schema_overrides: { comments: { 'ui:placeholder': 'Your role at camp, and anything the staff coordinator should know' } },
  },
  {
    name: 'late-registrant',
    label: 'Late Registrant',
    invitation_email_subject: 'Register late for Sample Camp',
    invitation_email_template: invitation('a late registrant'),
  },
] satisfies RegistrationType[];
