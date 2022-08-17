/**
 * PayPalProvider
 *
 * A wrapper for PayPalScriptProvider that allows the `options` prop to be set
 * dynamically, and defers fetching the PayPal JS SDK until it is set. Note that
 * the SDK will be reloaded if the `options` prop changes.
 */

import React, { FC, useEffect } from 'react';
import { PayPalScriptProvider, usePayPalScriptReducer } from "@paypal/react-paypal-js";

interface Props {
  options?: { "client-id": string } | null;
}

const PayPalOptionsResetter: FC<Props> = props => {
  const [, dispatch] = usePayPalScriptReducer();

  useEffect(() => {
    if (props.options) {
      dispatch({
        type: "resetOptions",
        value: props.options,
      });
    }
  }, [dispatch, props.options]);

  return (
    <>
      {props.children}
    </>
  );
};

const PayPalProvider: FC<Props> = props => {
  return (
    <PayPalScriptProvider
      deferLoading={!props.options}
      options={props.options || { "client-id": "NONE" }}
    >
      <PayPalOptionsResetter options={props.options}>
        {props.children}
      </PayPalOptionsResetter>
    </PayPalScriptProvider>
  );
};

export default PayPalProvider;
