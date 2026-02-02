import * as priceLists from './pricing/pricingLists.js';
import * as pricing from './pricing/pricing.js';
// 'recipient_name': to_name or to_email,
// 'recipient_email': to_email,
// 'invitation_code': invitation.invitation_code,
// 'register_link': register_page_url(request, event.id, invitation)

const createCrewEmailTemplate = (regType) => `
Dear {{recipient_name}},

You have been invited to join the following Lark Camp crew:

${regType.label}

[Please click here to register!]({{register_link}})
${priceLists.crewCamp.includes(regType) && `

You will be charged a non-refundable enrollment fee of $${pricing.crew_enrollment}.`}

If you need a parking pass YOU MUST ADD ONE. This is not done automatically. If
you are not sure if you need one, add one.  It is easier to remove a pass than
add one at the last minute. ${(priceLists.freeParking.includes(regType) && `
You will not be charged for a parking pass.`) || (priceLists.crewParking.includes(regType) && `
As a member of Lark Camp's crew, you will only be charged $${pricing.crew_parking_pass}
for parking passes.`)}
${priceLists.freeMeals.includes(regType) && `

You will not be charged for meals, please make sure to include a meal selection
in your registration.`}
${priceLists.freeBadge.includes(regType) && `

You will not be charged for a name badge, please make sure to include a name
badge in your registration.`}

If you have a specific lodging request, please make a note in the lodging
preferences box. Please remember that lodging choices are first come/ first
served. We will do our best to accommodate your choice. If you need special
lodging that is not on the list, and you have cleared this with the registrar
already, please describe your needs in the lodging preferences box, and select
"Let registrar assign my lodging" as your lodging choice.  

If you do not have a payment amount due, select “pay by check” on the final step.  

If you have any other questions, please email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

All the best,

The LTA Lark Camp Committee

https://www.larkcamp.org

https://www.larktraditionalarts.org
`;

const crewEmailTemplateOverrides = {
  'kitchen-full': () => `
Dear {{recipient_name}},

Below is your personalized link to register for Lark Camp 2024 as Full Trade Kitchen Crew (includes kitchens, coffeehouses, & bakery).

[Please click here to register!]({{register_link}})

NEVER REGISTERED IN THIS SYSTEM?

It is strongly advised you view the following tutorial if you have not registered before: 
[Crew Registration Tutorial](https://docs.google.com/presentation/d/1WVzKpV1GwBzJPK_p-CbBAv5Ok772VqO1-QEMxvCLTdY/present?slide=id.g22e59be6521_0_59)

If you have a specific lodging request, please make a note in the lodging
preferences box. Please remember that lodging choices are on a first come/ first
served basis. We will do our best to accommodate your choice. If you need special
lodging that is not on the list, and you have cleared this with the registrar
already, please describe your needs in the lodging preferences box, and select
"Let registrar assign my lodging" as your lodging choice.  

Select “pay by check” on the final step as your cost to attend Lark is free with a full trade.  

If you have any questions about registering, please email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

If you have questions about your work trade or shift, please contact: Rosemary and Jed: [larkkitchen@gmail.com](mailto:larkkitchen@gmail.com) or

Amy: [larkamy@gmail.com](mailto:larkamy@gmail.com)

All the best,

The LTA Lark Camp Committee

https://www.larkcamp.org

https://www.larktraditionalarts.org`,
  'kitchen-partial': () => `
Dear {{recipient_name}},

Below is your personalized link to register  for Lark Camp 2024 as Partial Pay Kitchen Crew (includes kitchens, coffeehouses, & bakery).

[Please click here to register!]({{register_link}})

NEVER REGISTERED IN THIS SYSTEM?

It is strongly advised you view the following tutorial if you have not registered before: 
[Crew Registration Tutorial](https://docs.google.com/presentation/d/1WVzKpV1GwBzJPK_p-CbBAv5Ok772VqO1-QEMxvCLTdY/present?slide=id.g22e59be6521_0_59)

If you have a specific lodging request, please make a note in the lodging
preferences box. Please remember that lodging choices are on a first come/ first
served basis. We will do our best to accommodate your choice. If you need special
lodging that is not on the list, and you have cleared this with the registrar
already, please describe your needs in the lodging preferences box, and select
"Let registrar assign my lodging" as your lodging choice.  

If you have any questions about registering, please email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)
If you have questions about your work trade or shift, please contact: 

Rosemary and Jed: [larkkitchen@gmail.com](mailto:larkkitchen@gmail.com) or

Amy: [larkamy@gmail.com](mailto:larkamy@gmail.com)

All the best,

The LTA Lark Camp Committee

https://www.larkcamp.org

https://www.larktraditionalarts.org`,
  'late-registrant': () => `
Dear {{recipient_name}},

You have been invited to register late to Lark Camp!

[Please click here to register!]({{register_link}})

If you have any other questions, please email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

All the best,

The LTA Lark Camp Committee

https://www.larkcamp.org

https://www.larktraditionalarts.org`,
  'reg-volunteer': () => `
Dear {{recipient_name}},

Thank you for volunteering to be on our registration volunteer list! This
volunteering in this way entitles you to the following perks:

- You are allowed in early to help with setup and allows you to setup your
  campsite early before other campers arrive
- You get a free name badge

[Please click here to register!]({{register_link}})

If you need a parking pass YOU MUST ADD ONE. This is not done automatically. If
you are not sure if you need one, add one.  It is easier to remove a pass than
add one at the last minute. 

You will not be charged for a name badge, please make sure to include a name
badge in your registration.

If you have any other questions, please email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

All the best,

The LTA Lark Camp Committee

https://www.larkcamp.org

https://www.larktraditionalarts.org
`,
};

const specialType = (regType) => ({
  ...regType,
  invitation_email_subject: `Register for Lark Camp ${regType.label}`,
  invitation_email_template:
    crewEmailTemplateOverrides[regType.name]
      ? crewEmailTemplateOverrides[regType.name](regType)
      : createCrewEmailTemplate(regType),
});

export const regTypes = [
  { name: 'bus-driver', label: 'Bus Driver' },
  { name: 'reg-volunteer', label: 'Registration Volunteer' },
  { name: 'cleanup-camp-1', label: 'Camp 1 cleanup crew' },
  { name: 'cleanup-camp-2', label: 'Camp 2 cleanup crew' },
  { name: 'cleanup-camp-3', label: 'Camp 3 cleanup crew' },
  { name: 'kitchen-full', label: 'Kitchen crew' },
  { name: 'kitchen-partial', label: 'Kitchen crew - partial pay' },
  { name: 'late-registrant', label: 'Late Registrant' },
  { name: 'management', label: 'Management' },
  { name: 'misc-staff', label: 'Miscellaneous Staff' },
  { name: 'office-camp-1', label: 'Camp 1 office crew' },
  { name: 'office-camp-2', label: 'Camp 2 office crew' },
  { name: 'office-camp-3', label: 'Camp 3 office crew' },
  { name: 'community-care', label: 'Community Care' },
  { name: 'setup-teardown', label: 'Setup/teardown crew' },
  { name: 'talent', label: 'Talent Staff' },
  { name: 'talent-guest', label: 'Guest of Talent Staff' },
];

export default regTypes.map(specialType);
