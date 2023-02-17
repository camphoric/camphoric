/**
 * PayPalProvider
 *
 * A wrapper for PayPalScriptProvider that allows the `options` prop to be set
 * dynamically, and defers fetching the PayPal JS SDK until it is set. Note that
 * the SDK will be reloaded if the `options` prop changes.
 */

import React, { FC, useEffect } from 'react';
import {
  PayPalScriptProvider,
  usePayPalScriptReducer,
  ScriptContextDerivedState,
} from '@paypal/react-paypal-js';

export type PayPalStats = ScriptContextDerivedState;

interface Props {
  options?: { "client-id": string } | null;
  onStatsChange?: (a: PayPalStats) => void;
}

const PayPalOptionsResetter: FC<Props> = props => {
  const [stats, dispatch] = usePayPalScriptReducer();

  useEffect(() => {
    if (props.onStatsChange) {
      props.onStatsChange(stats);
    }
  }, [stats, props]);

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
      <PayPalOptionsResetter options={props.options} onStatsChange={props.onStatsChange}>
        {props.children}
      </PayPalOptionsResetter>
    </PayPalScriptProvider>
  );
};

export default PayPalProvider;
