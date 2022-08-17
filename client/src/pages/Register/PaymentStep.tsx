import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import type { FUNDING_SOURCE } from "@paypal/paypal-js";
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

  const payPalOptions = props.config && props.config.payPalOptions ? props.config.payPalOptions : null;

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
                return actions.order.create({
                  purchase_units: [
                    {
                      amount: {
                        value: (props.totals.total || 0).toFixed(2),
                      },
                    },
                  ],
                });
              }}
              onApprove={async (data, actions) => {
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
