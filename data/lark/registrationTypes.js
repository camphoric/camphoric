// 'recipient_name': to_name or to_email,
// 'recipient_email': to_email,
// 'invitation_code': invitation.invitation_code,
// 'register_link': register_page_url(request, event.id, invitation)

const createCrewEmailTemplate = (label) => `
Dear {{recipient_name}},

You have been invited to join the following Lark Camp crew:

${label}

[Please click here to register!]({{register_link}})

If you have a specific lodging request, please make a note in the lodging
comment box. Please remember that lodging choices are first come/ first served.
We will do our best to accommodate your choice you have a specific lodging
request, please make a note in the lodging comment box. Please remember that
lodging choices are first come/ first served. We will do our best to
accommodate your choice.  If you need special lodging not on the list, and you
have cleared this with the registrar already, please describe your needs in the
lodging comment box, and select "Let registrar assign my lodging" as your
lodging choice.

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
  {
    name: 'management',
    label: 'Management',
    invitation_email_subject: 'Register as Lark Management Staff',
    invitation_email_template: createCrewEmailTemplate('Lark management'),
  },
];
