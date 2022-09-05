import React from 'react';
import type {
  PayPalButtonsComponentOptions,
  SHIPPING_PREFERENCE,
} from '@paypal/paypal-js';
import debug from 'utils/debug';
import { Spinner } from 'react-bootstrap';
// import Spinner from 'components/Spinner';

import checkImage from './check-image.png';
import PayPalButtons from './PayPalButtons';
import type { RegisterStepProps } from './component';

export type PayPalCreateOrder = PayPalButtonsComponentOptions['createOrder'];
export type PayPalOnApprove = PayPalButtonsComponentOptions['onApprove'];

function PaymentStep(props: RegisterStepProps) {
  const [loading, setLoading] = React.useState(false);

  if (props.step !== 'payment') return null;

  const payPalCreateOrder: PayPalCreateOrder = (data, actions) => {
    debug('payPalCreateOrder');
    const description = `${props.config.dataSchema.title} payment for ${props.formData.registrant_email}`;
    const order = {
      purchase_units: [
        {
          amount: {
            value: (props.totals.total || 0).toFixed(2),
          },
          description,
          invoice_id: props.UUID,
          reference_id: props.UUID,
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING' as SHIPPING_PREFERENCE,
      },
    };

    debug('order', order);

    return actions.order.create(order);
  };

  const payPalOnApprove: PayPalOnApprove = async (data, actions) => {
    if (!actions || !actions.order) return;
    setLoading(true);
    debug('payPalOnApprove');

    try {
      const capture = await actions.order.capture();

      debug('PayPalOnApprove capture', capture);
      props.submitPayment('PayPal', capture);
    } catch (e) {
      setLoading(false);
      debug('capture error!', e);
    }
  };

  const submitPayByCheck = () => {
    setLoading(true);
    props.submitPayment('Check');
  };

  return (
    <div
      className="payment-form"
    >
      {
        !!loading && (
          <div className="payment-disable-overlay">
            <div>
              <Spinner animation="border" />
            </div>
          </div>
        )
      }
      <h1>Choose your payment option</h1>
      <button
        onClick={submitPayByCheck}
        className="payby-check-button"
      >
        <img alt="Check" src={checkImage} />
        Check
      </button>
      <PayPalButtons
        {...props}
        payPalCreateOrder={payPalCreateOrder}
        payPalOnApprove={payPalOnApprove}
      />
    </div>
  );
}

export default PaymentStep;
