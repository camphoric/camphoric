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
