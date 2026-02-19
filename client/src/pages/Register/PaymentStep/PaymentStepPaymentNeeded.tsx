import React from 'react';
import type {
  FUNDING_SOURCE,
  PayPalScriptOptions,
  OrderResponseBody,
  PayPalButtonCreateOrder,
  PayPalButtonOnApprove,
  CreateOrderRequestBody,
} from '@paypal/paypal-js';

import {
  PayPalScriptProvider,
} from '@paypal/react-paypal-js';

import debug from 'utils/debug';
import { moneyFmt } from 'utils/display';
import jsonLogic from 'json-logic-js';
import Spinner from 'components/Spinner';
import JsonSchemaForm, { calculatePrice } from 'components/JsonSchemaForm';
import api, {
  PaymentType,
  DepositType,
} from 'store/register/api';
import {
  useRegFormData,
  setConfirmationStep,
  setPaymentInfo,
  useAppDispatch,
  setTotals,
} from 'store/register/store';

import { useNavigateToRegPage } from '../utils';
import checkImage from './check-image.png';
import PayPalButtons from './PayPalButtons';

export type PayPalCreateOrder = PayPalButtonCreateOrder;
export type PayPalOnApprove = (a: FUNDING_SOURCE) => PayPalButtonOnApprove;

function PaymentStepPaymentNeeded() {
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
    totals,
    depositChoice,
    regFormData,
  });

  const payPalCreateOrder: PayPalButtonCreateOrder = async (data, actions) => {
    debug('payPalCreateOrder', paymentInfo);
    setLoading(true);
    const description = `${config.dataSchema.title} payment for ${regFormData.registration.registrant_email}`;
    const order: CreateOrderRequestBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: total.toString() },
          description,
          invoice_id: paymentStep.registrationUUID,
          reference_id: paymentStep.registrationUUID,
          custom_id: JSON.stringify(paymentInfo),
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    };

    const response = await actions.order.create(order);

    debug('order', order, response);

    return response;
  };

  const onDepositChange = ({ formData }: { formData: { deposit: string  } }, newTotals?: any) => {
    try {
      setDepositChoice(formData);
      const values = JSON.parse(formData.deposit);

      const newTotal = jsonLogic.apply(values.logic, newTotals || totals);
      setTotal(newTotal);

      return newTotal;
    } catch (e) {
      console.error('deposit logic error', e);
    }

  };

  const processResult = async (paymentType: PaymentType, payPalResponse?: OrderResponseBody) => {
    let depositType: DepositType = 'none';

    let finalTotal = total;
    // If they get a check discount, we need to give that here.
    if (registrationApi.data?.event?.epayment_handling && paymentType === 'Check') {
      const newTotals = calculatePrice(
        registrationApi.data,
        regFormData.registration,
        paymentType,
      );

      if (depositChoice) {
        dispatch(setTotals(newTotals));
        finalTotal = onDepositChange({ formData: depositChoice }, newTotals);
      }
    }

    debug('finalTotal', finalTotal);
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
        total: finalTotal,
      },
      payPalResponse,
    };

    debug('initialPayment', initialPayment);

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
      const paymentDataString = payPalResponse.purchase_units && payPalResponse.purchase_units[0]?.custom_id;

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

  let payPalOptions: PayPalScriptOptions | undefined = config.payPalOptions;

  if (import.meta.env.DEV && !!payPalOptions && !payPalOptions.clientId) {
    payPalOptions = {
      ...payPalOptions,
      clientId: 'sb',
    };
  }

  console.log({ payPalOptions });

  return (
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
      <h3>Total: {moneyFmt(total)}</h3>
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
      <p>
        If you would like to pay by credit card, please select "PayPal", then
        select "Pay with debit or credit card" in the PayPal window.

      </p>
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
  );
}

export default PaymentStepPaymentNeeded;
