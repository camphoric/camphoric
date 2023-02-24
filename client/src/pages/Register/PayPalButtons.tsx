import React, { MutableRefObject, useRef } from 'react';
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
  setLoading: (a: boolean) => void;
};

interface InstanceData {
  props: Props;
  methods: {
    createOrder: PayPalCreateOrder;
    onApprove: PayPalOnApprove;
  };
};

function PayPalButtonsComponent(props: Props) {

  // The PayPalButtons component from @paypal/react-paypal-js doesn't seem to
  // update with the current values of the createOrder and onApprove props, but
  // always uses the initial values passed in. It has a forceReRender prop which
  // doesn't seem to help. As a workaround, create persistent wrapper functions
  // that call the current versions of these props.
  const instance = useRef<InstanceData>({
    props,
    methods: {
      createOrder: (data, actions) => instance.current.props.payPalCreateOrder(data, actions),
      onApprove: (fundingSource) => instance.current.props.payPalOnApprove(fundingSource),
    },
  }) as MutableRefObject<InstanceData>;
  instance.current.props = props;

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
    <PayPalProvider
      options={payPalOptions}
      onStatsChange={(stats) => {
        props.setLoading(!stats.isResolved);
      }}
    >
      {
        payPalFundingSources.map((fundingSource) => (
          <PayPalButtons
            key={fundingSource}
            fundingSource={fundingSource}
            createOrder={instance.current.methods.createOrder}
            onApprove={instance.current.methods.onApprove(fundingSource)}
          />
      ))
    }
    </PayPalProvider>
  );
}

export default PayPalButtonsComponent;
