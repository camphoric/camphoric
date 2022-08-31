import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import getFromPath from 'lodash/get';
import PayPalProvider from 'components/PayPalProvider';
import debug from 'utils/debug';

import type {
  FUNDING_SOURCE,
  PayPalScriptOptions,
  PayPalButtonsComponentOptions,
  SHIPPING_PREFERENCE,
} from '@paypal/paypal-js';

import type { RegisterStepProps } from './component';

type PayPalCreateOrder = PayPalButtonsComponentOptions['createOrder'];
type PayPalOnApprove = PayPalButtonsComponentOptions['onApprove'];

const payPalFundingSources: Array<FUNDING_SOURCE> = [
  'paypal',
  'card',
];

function PayPalButtonsComponent(props: RegisterStepProps) {
  const optionsFromConfig = getFromPath(props, 'config.payPalOptions');

  debug('formData', props.formData);
  debug('config', props.config);

  if (!optionsFromConfig) return null;

  const payPalOptions: PayPalScriptOptions = {
    ...optionsFromConfig,
    // put overrides here
    // ....
  };

  if (process.env.NODE_ENV === 'development' && !payPalOptions['client-id']) {
    payPalOptions['client-id'] = 'sb';
  }

  const description = `${props.config.dataSchema.title} payment for ${props.formData.registrant_email}`;
  const order = {
    purchase_units: [
      {
        amount: {
          value: (props.totals.total || 0).toFixed(2),
        },
        description,
        invoice_id: props.UUID,
      },
    ],
    application_context: {
      shipping_preference: 'NO_SHIPPING' as SHIPPING_PREFERENCE,
    },
  };

  debug('order', order);

  const createOrder: PayPalCreateOrder = (data, actions) =>
    actions.order.create(order);

  const onApprove: PayPalOnApprove = async (data, actions) => {
    // window.PayPalOnApprove = { data, actions };
    // console.log('PayPalOnApprove', window.PayPalOnApprove);

    if (!actions || !actions.order) return;

    try {
      const capture = await actions.order.capture();

      debug('PayPalOnApprove capture', capture);
      props.submitPayment('PayPal', capture);
    } catch (e) {
      throw e;
    }
  };

  return (
    <PayPalProvider options={payPalOptions}>
      {
        payPalFundingSources.map((fundingSource) => (
          <PayPalButtons
            key={fundingSource}
            fundingSource={fundingSource}
            createOrder={createOrder}
            onApprove={onApprove}
          />
      ))
    }
    </PayPalProvider>
  );
}

export default PayPalButtonsComponent;


/*
sample response from the capture of a paypal transaction, this is probably what
will be sent back to the server.
{
  "id": "480149857L661650P",
  "intent": "CAPTURE",
  "status": "COMPLETED",
  "purchase_units": [
    {
      "reference_id": "default",
      "amount": {
        "currency_code": "USD",
        "value": "150.00"
      },
      "payee": {
        "email_address": "willfulbard-facilitator@gmail.com",
        "merchant_id": "9SYVBP6AN2C7Y"
      },
      "payments": {
        "captures": [
          {
            "id": "63D62097DL1509748",
            "status": "COMPLETED",
            "amount": {
              "currency_code": "USD",
              "value": "150.00"
            },
            "final_capture": true,
            "seller_protection": {
              "status": "ELIGIBLE",
              "dispute_categories": [
                "ITEM_NOT_RECEIVED",
                "UNAUTHORIZED_TRANSACTION"
              ]
            },
            "create_time": "2022-08-27T20:47:10Z",
            "update_time": "2022-08-27T20:47:10Z"
          }
        ]
      }
    }
  ],
  "payer": {
    "name": {
      "given_name": "test",
      "surname": "buyer"
    },
    "email_address": "willfulbard-buyer@gmail.com",
    "payer_id": "FGMUH3KCNJR9Q",
    "address": {
      "country_code": "US"
    }
  },
  "create_time": "2022-08-27T20:46:53Z",
  "update_time": "2022-08-27T20:47:10Z",
  "links": [
    {
      "href": "https://api.sandbox.paypal.com/v2/checkout/orders/480149857L661650P",
      "rel": "self",
      "method": "GET"
    }
  ]
}


sample response from the capture of a cc transaction, this is probably what
will be sent back to the server.

{
  "id": "8WL672002P855583W",
  "intent": "CAPTURE",
  "status": "COMPLETED",
  "purchase_units": [
    {
      "reference_id": "default",
      "amount": {
        "currency_code": "USD",
        "value": "150.00"
      },
      "payee": {
        "email_address": "willfulbard-facilitator@gmail.com",
        "merchant_id": "9SYVBP6AN2C7Y"
      },
      "soft_descriptor": "PAYPAL *FACILITATOR",
      "payments": {
        "captures": [
          {
            "id": "2U743578XH837411V",
            "status": "COMPLETED",
            "amount": {
              "currency_code": "USD",
              "value": "150.00"
            },
            "final_capture": true,
            "seller_protection": {
              "status": "ELIGIBLE",
              "dispute_categories": [
                "ITEM_NOT_RECEIVED",
                "UNAUTHORIZED_TRANSACTION"
              ]
            },
            "create_time": "2022-08-27T21:00:41Z",
            "update_time": "2022-08-27T21:00:41Z"
          }
        ]
      }
    }
  ],
  "payer": {
    "name": {
      "given_name": "Will",
      "surname": "Wheeler"
    },
    "email_address": "willfulbard@gmail.com",
    "payer_id": "7MDKBPT8XK25N",
    "address": {
      "country_code": "US"
    }
  },
  "create_time": "2022-08-27T20:57:26Z",
  "update_time": "2022-08-27T21:00:41Z",
  "links": [
    {
      "href": "https://api.sandbox.paypal.com/v2/checkout/orders/8WL672002P855583W",
      "rel": "self",
      "method": "GET"
    }
  ]
}
*/

