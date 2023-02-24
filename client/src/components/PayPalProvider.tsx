/**
 * PayPalProvider
 *
 * A wrapper for PayPalScriptProvider that allows the `options` prop to be set
 * dynamically, and defers fetching the PayPal JS SDK until it is set. Note that
 * the SDK will be reloaded if the `options` prop changes based on a shallow
 * comparison (i.e. if any keys or values change).
 */

import React, { FC, useEffect } from 'react';
import {
  PayPalScriptProvider,
  usePayPalScriptReducer,
  ScriptContextDerivedState,
} from '@paypal/react-paypal-js';

import type { PayPalScriptOptions } from '@paypal/paypal-js';

export type PayPalStats = ScriptContextDerivedState;

interface Props {
  options?: PayPalScriptOptions;
  onStatsChange?: (a: PayPalStats) => void;
}

const PayPalOptionsResetter: FC<Props> = props => {
  const [stats, dispatch] = usePayPalScriptReducer();

  useEffect(() => {
    if (props.onStatsChange) {
      props.onStatsChange(stats);
    }
  }, [stats, props]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (props.options) {
      dispatch({
        type: "resetOptions",
        value: props.options,
      });
    }
  }, [
    dispatch,
    // allows useEffect to do a shallow comparison of props.options
    // @ts-ignore
    ...Object.keys(props.options || {}).sort().flatMap(k => [k, (props.options || {})[k]]),
  ]);

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
