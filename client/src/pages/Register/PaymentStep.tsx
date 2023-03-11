import React from 'react';
import type {
  PayPalButtonsComponentOptions,
  SHIPPING_PREFERENCE,
  FUNDING_SOURCE,
} from '@paypal/paypal-js';
import debug from 'utils/debug';
import { Spinner } from 'react-bootstrap';
import jsonLogic from 'json-logic-js';
import JsonSchemaForm from 'components/JsonSchemaForm';

import type { PaymentType } from './index';
import checkImage from './check-image.png';
import PayPalButtons from './PayPalButtons';
import type { RegisterStepProps } from './component';

export type PayPalCreateOrder = NonNullable<PayPalButtonsComponentOptions['createOrder']>;
export type PayPalOnApprove = (a: FUNDING_SOURCE) => PayPalButtonsComponentOptions['onApprove'];

function PaymentStep(props: RegisterStepProps) {
  const [loading, setLoading] = React.useState(false);
  const [depositChoice, setDepositChoice] = React.useState<{ deposit: any } | undefined>();
  if (props.step !== 'payment') return null;

  const paymentData = {
    type: 'payment',
    total: (props.totals.total || 0).toFixed(2),
  };

  if (depositChoice?.deposit) {
    try {
      const values = JSON.parse(depositChoice.deposit);
      const results = jsonLogic.apply(values.logic, props.totals);

      paymentData.type = values.name;
      paymentData.total = results;
    } catch (e) {
      console.error('deposit logic error', e);
    }
  }


  const payPalCreateOrder: PayPalCreateOrder = async (data, actions) => {
    debug('payPalCreateOrder', paymentData);
    setLoading(true);
    const description = `${props.config.dataSchema.title} ${paymentData.type} for ${props.formData.registrant_email}`;
    const order = {
      purchase_units: [
        {
          amount: { value: paymentData.total.toString() },
          description,
          invoice_id: props.UUID,
          reference_id: props.UUID,
          custom_id: JSON.stringify(paymentData),
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING' as SHIPPING_PREFERENCE,
      },
    };

    debug('order', order, paymentData);

    const response = await actions.order.create(order);

    debug('order', order, response);

    return response;
  };

  const payPalOnApprove: PayPalOnApprove = (fundingSource: FUNDING_SOURCE) => async (data, actions) => {
    if (!actions || !actions.order) return;
    setLoading(true);

    let paymentType: PaymentType = 'PayPal';

    if (fundingSource === 'card') paymentType = 'Card';

    debug('payPalOnApprove, type: ', paymentType);

    try {
      const payPalResponse = await actions.order.capture();
      const paymentDataString = payPalResponse.purchase_units[0]?.custom_id;

      debug('PayPalOnApprove capture', payPalResponse);
      props.submitPayment({
        paymentType,
        paymentData: JSON.parse(paymentDataString || ''),
        payPalResponse,
      });
    } catch (e) {
      setLoading(false);
      debug('capture error!', e);
    }
  };

  const submitPayByCheck = () => {
    setLoading(true);

    props.submitPayment({
      paymentType: 'Check',
      paymentData,
    });
  };

  return (
    <div className="payment-form">
      <h1>Choose your payment option</h1>
      <h3>Total: ${paymentData.total}</h3>
      {
        props.deposit && (
          <JsonSchemaForm
            schema={{ 
              type: 'object',
              properties: {
                deposit: {
                  type: 'string',
                  ...props.deposit,
                }
              }
            }}
            uiSchema={{
              deposit: {
                'ui:placeholder': 'Choose an option',
              }
            }}
            onChange={(arg) => setDepositChoice(arg.formData)}
            formData={depositChoice}
            templateData={{ }}
            noHtml5Validate
          >&nbsp;</JsonSchemaForm>
        )
      }
      {
        !!loading && (
          <div className="payment-disable-overlay">
            <div>
              <Spinner animation="border" />
            </div>
          </div>
        )
      }
      <button
        onClick={submitPayByCheck}
        className="payby-check-button"
      >
        <img alt="Check" src={checkImage} />
        Check
      </button>
      <PayPalButtons
        {...props}
        setLoading={setLoading}
        payPalCreateOrder={payPalCreateOrder}
        payPalOnApprove={payPalOnApprove}
      />
    </div>
  );
}

export default PaymentStep;
