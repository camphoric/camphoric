import React from 'react';
import type {
  PayPalButtonsComponentOptions,
  SHIPPING_PREFERENCE,
  FUNDING_SOURCE,
  PayPalScriptOptions,
  OrderResponseBody,
} from '@paypal/paypal-js';

import {
  PayPalScriptProvider,
} from '@paypal/react-paypal-js';

import debug from 'utils/debug';
import jsonLogic from 'json-logic-js';
import Spinner from 'components/Spinner';
import JsonSchemaForm from 'components/JsonSchemaForm';
import api, {
  PaymentType,
  DepositType,
} from 'store/register/api';
import {
  useRegFormData,
  setConfirmationStep,
  setPaymentInfo,
  useAppDispatch,
} from 'store/register/store';

import { useNavigateToRegPage } from './utils';
import checkImage from './check-image.png';
import PayPalButtons from './PayPalButtons';
import PageWrapper from './PageWrapper';

export type PayPalCreateOrder = NonNullable<PayPalButtonsComponentOptions['createOrder']>;
export type PayPalOnApprove = (a: FUNDING_SOURCE) => PayPalButtonsComponentOptions['onApprove'];

function PaymentStep() {
  const registrationApi = api.useGetRegistrationQuery();
  const [createInitialPayment] = api.useCreateInitialPaymentMutation();
  const regFormData = useRegFormData();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = React.useState(false);
  const [depositChoice, setDepositChoice] = React.useState<{ deposit: any }>();
  const [total, setTotal] = React.useState<number>(
    regFormData.paymentStep?.serverPricingResults.total || 0
  );
  const navigateToRegPage = useNavigateToRegPage();

  if (!regFormData.paymentStep) {
    navigateToRegPage('/registration');

    return null;
  }

  if (
    registrationApi.isFetching ||
    registrationApi.isLoading ||
    !registrationApi.data
  ) return <Spinner />;

  const {
    paymentStep,
    paymentInfo,
  } = regFormData;
  const totals = paymentStep.serverPricingResults;
  const config = registrationApi.data;

  debug('PaymentStep info', {
    total,
    depositChoice,
    regFormData,
  });

  const payPalCreateOrder: PayPalCreateOrder = async (data, actions) => {
    debug('payPalCreateOrder', paymentInfo);
    setLoading(true);
    const description = `${config.dataSchema.title} payment for ${regFormData.registration.registrant_email}`;
    const order = {
      purchase_units: [
        {
          amount: { value: total.toString() },
          description,
          invoice_id: paymentStep.registrationUUID,
          reference_id: paymentStep.registrationUUID,
          custom_id: JSON.stringify(paymentInfo),
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING' as SHIPPING_PREFERENCE,
      },
    };

    const response = await actions.order.create(order);

    debug('order', order, response);

    return response;
  };

  const processResult = async (paymentType: PaymentType, payPalResponse?: OrderResponseBody) => {
    let depositType: DepositType = 'none';

    try {
      const parsedDepositChoice = JSON.parse(depositChoice?.deposit);

      depositType = parsedDepositChoice.name;
    } catch (e) {
      // nothing to do here
    }

    const initialPayment = {
      registrationUUID: paymentStep.registrationUUID,
      paymentType,
      paymentData: {
        type: depositType,
        total,
      },
      payPalResponse,
    };

    dispatch(setPaymentInfo(initialPayment));
    const result = await createInitialPayment(initialPayment);

    if ('error' in result) {
      throw new Error(`error creating payment: ${JSON.stringify(result)}`);
    }

    const { data } = result;

    dispatch(setConfirmationStep(data));

    navigateToRegPage('/finished');
  }

  const payPalOnApprove: PayPalOnApprove = (fundingSource: FUNDING_SOURCE) => async (data, actions) => {
    if (!actions || !actions.order) return;
    setLoading(true);

    let paymentType: PaymentType = 'PayPal';

    if (fundingSource === 'card') paymentType = 'Card';

    debug('payPalOnApprove, type: ', paymentType);

    try {
      const payPalResponse = await actions.order.capture();
      const paymentDataString = payPalResponse.purchase_units[0]?.custom_id;

      debug('PayPalOnApprove capture', payPalResponse, paymentDataString);

      processResult(paymentType, payPalResponse);
    } catch (e) {
      setLoading(false);
      debug('capture error!', e);
    }
  };

  const submitPayByCheck = () => {
    setLoading(true);

    processResult('Check');
  };

  const onDepositChange = ({ formData }: { formData: { deposit: string  } }) => {
    try {
      setDepositChoice(formData);
      const values = JSON.parse(formData.deposit);

      setTotal(jsonLogic.apply(values.logic, totals));

    } catch (e) {
      console.error('deposit logic error', e);
    }

  }

  const payPalOptions: (PayPalScriptOptions | undefined) = config.payPalOptions;

  if (import.meta.env.DEV && !!payPalOptions && !payPalOptions['client-id']) {
    payPalOptions['client-id'] = 'sb';
  }

  return (
    <PageWrapper>
      <div className="payment-form" style={loading ? { pointerEvents: 'none' } : undefined}>
        {
          !!loading && (
            <div className="payment-disable-overlay">
              <div>
                <Spinner />
              </div>
            </div>
          )
        }
        <h1>Choose your payment option</h1>
        <h3>Total: ${(total || 0).toFixed(2)}</h3>
        {
          paymentStep.deposit && (
            <JsonSchemaForm
              schema={{ 
                type: 'object',
                properties: {
                  deposit: {
                    type: 'string',
                    ...paymentStep.deposit,
                  }
                }
              }}
              uiSchema={{
                deposit: {
                  'ui:placeholder': 'Choose an option',
                }
              }}
              onChange={onDepositChange}
              formData={depositChoice}
              templateData={{ }}
              noHtml5Validate
            >&nbsp;</JsonSchemaForm>
          )
        }
        <button
          onClick={submitPayByCheck}
          className="payby-check-button"
        >
          <img alt="Check" src={checkImage} />
          Check
        </button>
        {
          !!payPalOptions && (
            <PayPalScriptProvider
              options={payPalOptions}
              deferLoading
            >
              <PayPalButtons
                payPalOptions={payPalOptions}
                payPalCreateOrder={payPalCreateOrder}
                payPalOnApprove={payPalOnApprove}
              />
            </PayPalScriptProvider>
          )
        }
      </div>
    </PageWrapper>
  );
}

export default PaymentStep;
