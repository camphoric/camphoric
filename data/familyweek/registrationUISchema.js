const mainDescription = `
Please register yourself, children, and additional caregivers.
Please also let us know of any special needs, chore restrictions, special diet requirements, or housing requests.
If you have any questions about camp, please contact registrar Katie Riemer at (510) 684-1454 or familyweek@bacds.org.

###### COVID policy for camp (as of 3/22/22)

It is our goal to hold a safe and fun Family Week for our community. Although
there is always some risk of exposure to COVID when gathering in groups, we are
taking these actions to minimize the risk.

ALL staff will be vaccinated.

ALL campers must be vaccinated to the highest level they are ellgible.
If you choose to remain unvaccinated we respect your right to choose but, for this camp, we cannot include you.
Campers under age 5 cannot (at this time) be vaccinated.
We request that they have a PCR test within 72 hours of the start of camp and that the family isolate as much as possible until camp.
If you have a medical reason for not being vaccinated, please contact camp managers Simmy Cover (simmycover@mac.com) or Zia Rauwolf (zrauwolf@gmail.com).
We will consider individual cases and whether we can make exceptions.
Any exceptions will require testing.
We are subject to regulations from the state of California, Santa Cruz County, Monte Toyon, and BACDS.

Everyone must take a COVID test right before camp and provide a negative test result when entering camp.
This might be a PCR test within 72 hours of the start of camp, or a rapid test done upon arrival at camp.
If you do a rapid test, we will ask you to bring a test for each member of your family.
We will have a small supply of tests but cannot provide tests for everyone.
Please check with your doctor and insurance about coverage for home test kits.
Currently the U.S. government is providing free test kits.

Masks will not be required for dancing or other activities, but please feel free to wear a mask if you are more comfortable with one, and please respect everyone’s individual choices.
Please bring a mask for each person for the dining hall.
Many dining halls require everyone to be masked when going through the food line.
This may be required by Monte Toyon - it is too soon to predict what will be required in June 2022.

We will include COVID-related items in the packing list that will be sent before camp.

[Back to main Family Week website](https://www.bacds.org/familyweek/)

Please register before May 8th so we have enough people registered to hold camp.

###### Camper rates for 2023

| &nbsp; | Adults (17+) | Teens (13-16) | Kids (6-12) | Kids (2-5) | Kids (0-1) |
| --- | --- | --- | --- | --- | --- |
| Price: | $900/$800\* | $700 | $600 | $250 | $0 |

WORK TRADE: Adults may take a $250 and Teens may take a $200 reduction in fees in exchange for a work trade or workshop helper position. See [this page for details](https://www.bacds.org/familyweek/registration-notes/).

\*The second price is a discount price for any additional adults, after the first adult in a family group, who are not receiving a work trade discount. Work trade discounts are always taken off of the full adult price.
`;

export default {
  'ui:description': mainDescription,
  'ui:order': [
    'registrant_email',
    'address',
    'primary_phone',
    'secondary_phone',
    'ride_share',
    'ride_seats_offered',
    'campers',
    'donation',
    'payment_option',
  ],
  'address': {
    'ui:order': [
      'street_address',
      'city',
      'state_or_province',
      'zip_code',
      'country',
    ],
    'street_address': {'classNames': 'col-xs-12 col-sm-12'},
    'city': {'classNames': 'col-xs-12 col-sm-12'},
    'state_or_province': {'classNames': 'col-xs-6  col-sm-6'},
    'zip_code': {'classNames': 'col-xs-6  col-sm-6'},
    'country': {'classNames': 'col-xs-12 col-sm-6'}
  },
  'primary_phone': {
    'ui:widget': 'PhoneInput',
    'classNames': 'col-xs-6  col-sm-6',
  },
  'secondary_phone': {
    'ui:widget': 'PhoneInput',
    'classNames': 'col-xs-6  col-sm-6',
  },
  'ride_share': {
    'ui:widget': 'radio',
  },
  'payment_option': {
    'ui:widget': 'radio',
  },
  'campers': {
    // For some reason the title and description have to stay in the
    // ui-schema, or they're duplicated for each camper
    'ui:title': 'Camper Information',
    'ui:description': 'There is a big blue button below to add additional campers.',
    'ui:field': 'Campers',
    'ui:options': {
      'orderable': false
    },
    'items': {
      'ui:order': [
        'first_name',
        'last_name',
        'birthdate',
        'email',
        'work_trade',
        'meal_preferences',
        'special_needs',
        'housing_preferences',
      ],
      'housing_preferences': {
        'ui:widget': 'textarea',
        'ui:options': {
          'rows': 5
        },
      },
      'meal_preferences': {
        'ui:order': [
          'meal_type',
          'gluten_free',
          'dairy_free',
          'food_allergies',
        ],
      },
    },
  },
};
