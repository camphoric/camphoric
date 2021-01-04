export default {
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
        "payer_billing_address": {
          "contentClassNames": "address",
          "street_address":       { "classNames": "address" },
          "city":                 { "classNames": "city"  },
          "state_or_province":    { "classNames": "state"  },
          "zip_code":             { "classNames": "zip"  },
          "country":              { "classNames": "country"  }
        },
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
        "camper_address": {
          "contentClassNames": "address",
          "street_address":       { "classNames": "address" },
          "city":                 { "classNames": "city"  },
          "state_or_province":    { "classNames": "state"  },
          "zip_code":             { "classNames": "zip"  },
          "country":              { "classNames": "country"  }
        },
      }
    },
    "accommodations": {
      "classNames": "accommodations",
    },
    "comments": {
      "ui:widget": "textarea",
      "ui:options": {
        "rows": 5
      }
    },
    "tshirt_sizes": {
      "contentClassNames": "form-group form-row",
      "small":  { "ui:widget": "NaturalNumberInput"},
      "medium": { "ui:widget": "NaturalNumberInput" },
      "large":  { "ui:widget": "NaturalNumberInput" },
      "xl":     { "ui:widget": "NaturalNumberInput" },
      "xxl":    { "ui:widget": "NaturalNumberInput" },
    },
    "sweatshirt_sizes": {
      "contentClassNames": "form-group form-row",
      "small":  { "ui:widget": "NaturalNumberInput" },
      "medium": { "ui:widget": "NaturalNumberInput" },
      "large":  { "ui:widget": "NaturalNumberInput" },
      "xl":     { "ui:widget": "NaturalNumberInput" },
      "xxl":    { "ui:widget": "NaturalNumberInput" },
    },
};
