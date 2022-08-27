import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import type { FUNDING_SOURCE, PayPalScriptOptions } from "@paypal/paypal-js";
import PayPalProvider from 'components/PayPalProvider';
import { PricingResults } from 'components/JsonSchemaForm';

import { type FormDataState } from './index';

interface Props {
  config: FormDataState['config'];
  step: FormDataState['step'];
  onSubmit: (a: any) => Promise<void>;
  formData: FormDataState['formData'];
  totals: PricingResults;
}

const payPalFundingSources: Array<FUNDING_SOURCE> = [
  'paypal',
  'card',
];

function PaymentStep(props: Props) {
  if (props.step !== 'payment') return null;

  console.log('payment step');

  const optionsFromConfig = props.config && props.config.payPalOptions
    ? props.config.payPalOptions
    : {};

  const payPalOptions: PayPalScriptOptions = {
    ...optionsFromConfig,
    // put overrides here
    // ....
  };

  if (process.env.NODE_ENV === 'development') {
    payPalOptions['client-id'] = 'sb';
  }

  return (
    <div className="payment-form">
      <PayPalProvider options={payPalOptions}>
        <button className="payby-check-button">
          Pay by check
        </button>
        {
          payPalFundingSources.map((fundingSource) => (
            <PayPalButtons
              fundingSource={fundingSource}
              createOrder={(data, actions) => {
                window.PayPalCreateOrder = { data, actions };
                console.log('PayPalCreateOrder', window.PayPalCreateOrder);

                const order = {
                  purchase_units: [
                    {
                      amount: {
                        value: (props.totals.total || 0).toFixed(2),
                      },
                    },
                  ],
                  application_context: {
                    shipping_preference: 'NO_SHIPPING',
                  },
                };

                console.log('order', order);

                return actions.order.create(order);
              }}
              onApprove={async (data, actions) => {
                window.PayPalOnApprove = { data, actions };
                console.log('PayPalOnApprove', window.PayPalOnApprove);

                if (!actions || !actions.order) return;

                const capture = await actions.order.capture();

                console.log('PayPalOnApprove capture', capture);

                const name = capture.payer.name.given_name;
                console.log(`Transaction completed by ${name}`);

                console.log('capture', capture);

                // TODO return data to server
                // Wait till this completes before continuing
                // return actions.order.capture().then((details) => {
                //   const name = details.payer.name.given_name;
                //   alert(`Transaction completed by ${name}`);
                // });
              }}
            />
        ))
      }
      </PayPalProvider>
    </div>
  );
}

export default PaymentStep;


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
