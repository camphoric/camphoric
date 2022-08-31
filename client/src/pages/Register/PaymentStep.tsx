import React from 'react';

import checkImage from './check-image.png';
import PayPalButtons from './PayPalButtons';
import type { RegisterStepProps } from './component';

function PaymentStep(props: RegisterStepProps) {
  if (props.step !== 'payment') return null;

  const submitPayByCheck = () => props.submitPayment('Check');

  return (
    <div className="payment-form">
      <h1>Choose your payment option</h1>
      <button
        onClick={submitPayByCheck}
        className="payby-check-button"
      >
        <img alt="Check" src={checkImage} />
        Check
      </button>
      <PayPalButtons {...props} />
    </div>
  );
}

export default PaymentStep;
