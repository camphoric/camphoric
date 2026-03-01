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
import jsonLogic, { RulesLogic } from 'json-logic-js';
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
} from 'store/register/store';

import { useNavigateToRegPage } from '../utils';
import checkImage from './check-image.png';
import PayPalButtons from './PayPalButtons';

export type PayPalCreateOrder = PayPalButtonCreateOrder;
export type PayPalOnApprove = (a: FUNDING_SOURCE) => PayPalButtonOnApprove;

interface DepositChoice {
  deposit: string;
};

interface ParsedDeposit {
  name: string;
  logic: RulesLogic;
};

interface InitialPayment {
  registrationUUID: string;
    paymentType: PaymentType;
    paymentData: {
      type: DepositType,
      total: number,
    },
    payPalResponse?: OrderResponseBody,
};

// values passed via closure to PayPal
interface PayPalContext {
  deposit: DepositChoice;
}

function PaymentStepPaymentNeeded() {
  const registrationApi = api.useGetRegistrationQuery();
  const [postInitalPayment] = api.useCreateInitialPaymentMutation();
  const regFormData = useRegFormData();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = React.useState(false);
  // This value is the unparsed version
  const [depositChoice, setDepositChoice] = React.useState<DepositChoice>({ deposit: '' });
  const [total, setTotal] = React.useState<number>(
    regFormData.paymentStep?.serverPricingResults.total || 0
  );
  const navigateToRegPage = useNavigateToRegPage();

  React.useEffect(() => {
    if (!regFormData.paymentStep) return;

    setDepositChoice({ deposit: regFormData.paymentStep.deposit?.default as string || '' });

  }, [regFormData.paymentStep]);

  if (!regFormData.paymentStep) {
    navigateToRegPage('/registration');

    return null;
  }


  if (
    registrationApi.isFetching ||
    registrationApi.isLoading ||
    !registrationApi.data
  ) return <Spinner />;

  const { paymentStep } = regFormData;
  const totals = paymentStep.serverPricingResults;
  const config = registrationApi.data;

  debug('PaymentStepPaymentNeeded data at start of render', {
    total,
    totals,
    depositChoice,
    regFormData,
    paymentStep,
  });

  const getParsedDeposit = (formData?: DepositChoice): ParsedDeposit => {
    // set default result, this should never be returned, but it makes
    // typescript happy
    let result = {
      name: 'none' as string,
      logic: { '+': 0 },
    };

    try {
      result = JSON.parse(formData?.deposit || depositChoice.deposit);
    } catch (e) {
      debug('getParsedDeposit error', e);
    }

    return result;
  }

  const payPalCreateOrder = (context: PayPalContext): PayPalButtonCreateOrder => async (_data, actions) => {
    setLoading(true);
    const description = `${config.dataSchema.title} payment for ${regFormData.registration.registrant_email}`;

    let depositDescription = '';
    if (paymentStep.deposit) {
      const deposit = getParsedDeposit(context.deposit);
      depositDescription = deposit.name;
    }

    const order: CreateOrderRequestBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: moneyFmt(total) },
          description,
          // custom_id embeds the deposit choice, see payPalOnApprove below
          custom_id: depositDescription,
          reference_id: paymentStep.registrationUUID,
        },
      ],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
      },
    };

    const response = await actions.order.create(order);

    debug('payPalCreateOrder end', { order, response });

    return response;
  };

  const onDepositChange = ({ formData }: { formData: DepositChoice }, newTotals?: any) => {
    debug('onDepositChange start', formData);

    try {
      setDepositChoice(formData);
      const values = getParsedDeposit(formData);

      const newTotal = jsonLogic.apply(values.logic, newTotals || totals);

      debug('onDepositChange after jsonLogic', {
        choice: formData.deposit,
        newTotals,
        totals,
        newTotal,
      });

      setTotal(newTotal);

      return newTotal;
    } catch (e) {
      console.error('onDepositChange deposit logic error', e);
    }
  };

  const createInitialPayment = (
    paymentType: PaymentType,
    finalTotal: number,
    depositType: DepositType,
    payPalResponse?: object,
  ): InitialPayment => {
    return {
      registrationUUID: paymentStep.registrationUUID,
      paymentType,
      paymentData: {
        type: depositType,
        total: finalTotal,
      },
      payPalResponse,
    };
  }

  const processResult = async (initialPayment: InitialPayment) => {
    debug('processResult start', { initialPayment });

    dispatch(setPaymentInfo(initialPayment));
    const result = await postInitalPayment(initialPayment);

    if ('error' in result) {
      throw new Error(`error creating payment: ${JSON.stringify(result)}`);
    }

    const { data } = result;

    dispatch(setConfirmationStep(data));

    debug('processResult finished');
    navigateToRegPage('/finished');
  }

  const payPalOnApprove: PayPalOnApprove = (fundingSource: FUNDING_SOURCE) => async (data, actions) => {
    debug('payPalOnApprove start', { context, fundingSource, data, actions, depositChoice });

    if (!actions || !actions.order) return;
    setLoading(true);

    let paymentType: PaymentType = 'PayPal';

    if (fundingSource === 'card') paymentType = 'Card';

    debug('payPalOnApprove paymentType', paymentType);

    try {
      const payPalResponse = await actions.order.capture();
      debug('PayPalOnApprove capture', payPalResponse);

      const total = payPalResponse?.purchase_units ?
        parseFloat(payPalResponse.purchase_units[0].amount?.value || '0') : 0;


      // find deposit choice
      // as some sort of querk in the way that the PayPal code works, the
      // original deposit choice is gone, and the only way I can find to get it
      // back is to imbed it into the transaction (custom_id)
      let depositType = 'None'; // if deposits are not set up

      if (paymentStep.deposit) {
        debug('PayPalOnApprove find deposit choice', payPalResponse);
        depositType = (
          payPalResponse.purchase_units &&
          payPalResponse.purchase_units[0]?.custom_id
        ) || 'None';
      }

      const initialPayment = createInitialPayment(paymentType, total, depositType, payPalResponse)
      processResult(initialPayment);
    } catch (e) {
      setLoading(false);
      console.error('payPalOnApprove error', e);
    }
  };

  const submitPayByCheck = () => {
    setLoading(true);

    const newTotals = calculatePrice(
      config,
      regFormData.registration,
      'Check',
    );

    let depositType = 'None'; // if deposits are not set up
    let newTotal = newTotals.total;

    if (paymentStep.deposit) {
      const deposit = getParsedDeposit();
      depositType = deposit.name;
      newTotal = jsonLogic.apply(deposit.logic, newTotals);
    }

    debug('submitPayByCheck', {
      newTotal, depositType
    });

    const initialPayment = createInitialPayment('Check', newTotal, depositType);

    processResult(initialPayment);
  };

  let payPalOptions: PayPalScriptOptions | undefined = config.payPalOptions;

  if (import.meta.env.DEV && !!payPalOptions && !payPalOptions.clientId) {
    payPalOptions = {
      ...payPalOptions,
      clientId: 'sb',
    };
  }

  debug('PaymentStepPaymentNeeded rendering now', { payPalOptions });

  const context: PayPalContext = { deposit: depositChoice };

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
      <h3>Total: ${moneyFmt(total)}</h3>
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
              payPalCreateOrder={payPalCreateOrder(context)}
              payPalOnApprove={payPalOnApprove}
            />
          </PayPalScriptProvider>
        )
      }
    </div>
  );
}

export default PaymentStepPaymentNeeded;
