const createEmailTemplate = label => `
Dear {{ invitation.recipient_name or invitation.recipient_email }},

You have been invited to register for Family Week as ${label}.

[Please click here to register!]({{ invitation.register_url }})
`;

const invitation_email_subject = 'Family Week Special Registration Invitation';

export default [
  {
    name: 'talent',
    label: 'Talent Staff',
    invitation_email_subject,
    invitation_email_template: createEmailTemplate('Talent Staff'),
  },
  {
    name: 'management',
    label: 'Management Staff',
    invitation_email_subject,
    invitation_email_template: createEmailTemplate('Management Staff'),
  },
];
