import React, { MutableRefObject, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  usePayPalScriptReducer,
  getScriptID,
  destroySDKScript,
  PayPalButtons,
  SCRIPT_LOADING_STATE,
} from '@paypal/react-paypal-js';
import debug from 'utils/debug';

import type {
  FUNDING_SOURCE,
  PayPalScriptOptions,
} from '@paypal/paypal-js';

import type {
  PayPalCreateOrder,
  PayPalOnApprove,
} from './PaymentStep';

const payPalFundingSources: Array<FUNDING_SOURCE> = [
  'paypal',
  'card',
];

interface Props {
  payPalOptions: PayPalScriptOptions;
  payPalCreateOrder: PayPalCreateOrder;
  payPalOnApprove: PayPalOnApprove;
};

interface InstanceData {
  props: Props;
  methods: {
    createOrder: PayPalCreateOrder;
    onApprove: PayPalOnApprove;
  };
};

function PayPalButtonsComponent(props: Props) {
  const [, payPalDispatch] = usePayPalScriptReducer();
  const history = useHistory();

  React.useEffect(() => {
    payPalDispatch({
      type: 'setLoadingStatus',
      value: 'pending' as SCRIPT_LOADING_STATE,
    });

    // destroy on back, so this can be recreated
    const listener = history.listen((location, action) => {
      destroySDKScript(getScriptID(props.payPalOptions));

      listener();
    });
  }, [history, payPalDispatch, props.payPalOptions]);

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

  return (
    <>
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
    </>
  );
}

export default PayPalButtonsComponent;
