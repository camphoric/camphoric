import React from 'react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import getFromPath from 'lodash/get';
import PayPalProvider from 'components/PayPalProvider';
import debug from 'utils/debug';

import type {
  FUNDING_SOURCE,
  PayPalScriptOptions,
} from '@paypal/paypal-js';

import type { RegisterStepProps } from './component';
import type {
  PayPalCreateOrder,
  PayPalOnApprove,
} from './PaymentStep';

const payPalFundingSources: Array<FUNDING_SOURCE> = [
  'paypal',
  'card',
];

interface Props extends RegisterStepProps {
  payPalCreateOrder: PayPalCreateOrder;
  payPalOnApprove: PayPalOnApprove;
};

function PayPalButtonsComponent(props: Props) {
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

  return (
    <PayPalProvider options={payPalOptions}>
      {
        payPalFundingSources.map((fundingSource) => (
          <PayPalButtons
            key={fundingSource}
            fundingSource={fundingSource}
            createOrder={props.payPalCreateOrder}
            onApprove={props.payPalOnApprove(fundingSource)}
          />
      ))
    }
    </PayPalProvider>
  );
}

const areEqual = (prevProps: Props, nextProps: Props) => true;

// We don't actually want this to ever rerender, since if it does re-render
// while in the middle of a transaction, paypal will return the error
// "Window closed before response"
// see https://github.com/paypal/react-paypal-js/issues/104
export default React.memo(PayPalButtonsComponent, areEqual);

// export default PayPalButtonsComponent;
