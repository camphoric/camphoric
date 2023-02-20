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

const specialType = ({ name, label }) => ({
  name,
  label,
  invitation_email_subject: `Register for ${label}`,
  invitation_email_template: createCrewEmailTemplate(label),
});

export default [
  {
    name: 'crew-registration',
    label: 'Registration crew',
  },
  {
    name: 'crew-kitchen-full',
    label: 'Kitchen crew',
  },
  {
    name: 'crew-kitchen-partial',
    label: 'Kitchen crew - partial pay',
  },
  {
    name: 'crew-setup',
    label: 'Setup crew',
  },
  {
    name: 'crew-cleanup',
    label: 'Cleanup crew',
  },
  {
    name: 'talent',
    label: 'Talent Staff',
  },
  {
    name: 'management',
    label: 'Management',
  },
].map(specialType);
