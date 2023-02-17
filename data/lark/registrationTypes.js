// 'recipient_name': to_name or to_email,
// 'recipient_email': to_email,
// 'invitation_code': invitation.invitation_code,
// 'register_link': register_page_url(request, event.id, invitation)

const createCrewEmailTemplate = (label) => `
Dear {{recipient_name}},

You have been invited to join the following Lark Camp crew:

${label}

[Please click here to register!]({{register_link}})

If you have any other questions, please email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

All the best,

The LTA Lark Camp Committee

https://www.larkcamp.org

https://www.larktraditionalarts.org
`;

export default [
  {
    name: 'crew-registration',
    label: 'Registration crew',
    invitation_email_subject: 'Register for registration crew',
    invitation_email_template: createCrewEmailTemplate('Registration crew'),
  },
  {
    name: 'crew-kitchen-full',
    label: 'Kitchen crew',
    invitation_email_subject: 'Register for kitchen crew',
    invitation_email_template: createCrewEmailTemplate('Kitchen crew'),
  },
  {
    name: 'crew-kitchen-partial',
    label: 'Kitchen crew - partial pay',
    invitation_email_subject: 'Register for kitchen crew',
    invitation_email_template: createCrewEmailTemplate('Kitchen crew - partial pay'),
  },
  {
    name: 'crew-setup',
    label: 'Setup crew',
    invitation_email_subject: 'Register for setup crew',
    invitation_email_template: createCrewEmailTemplate('Setup crew'),
  },
  {
    name: 'crew-cleanup',
    label: 'Cleanup crew',
    invitation_email_subject: 'Register for cleanup crew',
    invitation_email_template: createCrewEmailTemplate('Cleanup crew'),
  },
  {
    name: 'talent',
    label: 'Talent Staff',
    invitation_email_subject: 'Register as Lark Staff',
    invitation_email_template: createCrewEmailTemplate('Lark staff'),
  },
];
