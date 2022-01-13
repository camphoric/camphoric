const address = {
  "ui:field": "Address",
  "ui:order": [
    "street_address",
    "city",
    "state_or_province",
    "zip_code",
    "country",
  ],
};

export default {
    "ui:order": [
      "registrant_email",
      "payment",
      "campers",
      "parking_passes",
      "lta_donation",
      "how_did_you_hear",
      "comments",
      "payment_full_or_deposit",
    ],
    "payment": {
      "contentClassNames": "camphoric-payment",
        "ui:order": [
          "payer_first_name",
          "payer_last_name",
          "payer_billing_address",
          "payer_number",
          "payment_type",
          "paypal_email",
          "payment_full_or_deposit",
        ],
        "payer_billing_address": address,
        "payer_number": {
          "ui:widget": "PhoneInput"
        },
    },
    "campers": {
      // For some reason the title and description have to stay in the
      // ui-schema, or their duplicated for each camper
      "ui:title": "Camper Information",
      "ui:description": "There is a big blue button below to add additional campers.  You may add up to 6 additional campers",
      "ui:field": "Campers",
      "ui:options": {
        "orderable": false
      },
      "items": {
        "ui:title": "Camper",
        "ui:order": [
          "first_name",
          "last_name",
          "gender",
          "age",
          "address_different_than_payer",
          "camper_address",
          "session",
          "meals",
          "lodging",
        ],
        "camper_address": address,
      }
    },
    "parking_passes": {
      "ui:options":  {
        "addable": true,
        "removable": true,
      },
      items: {
        "ui:title": "parking pass",
      }
    },
    "comments": {
      "ui:widget": "textarea",
      "ui:options": {
        "rows": 5
      }
    },
};
