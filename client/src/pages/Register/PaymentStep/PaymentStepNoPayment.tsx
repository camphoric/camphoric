import React from 'react';
import Spinner from 'components/Spinner';

import debug from 'utils/debug';
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

function PaymentStepNoPayment() {
  const [createInitialPayment] = api.useCreateInitialPaymentMutation();
  const navigateToRegPage = useNavigateToRegPage();
  const regFormData = useRegFormData();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = React.useState(false);

  const { paymentStep } = regFormData;

  if (!paymentStep) return <Spinner />;

  const processResult = async () => {
    setLoading(true);
    const depositType: DepositType = 'none';

    const initialPayment = {
      registrationUUID: paymentStep.registrationUUID,
      paymentType: 'Check' as PaymentType,
      paymentData: {
        type: depositType,
        total: 0,
      },
      payPalResponse: undefined,
    };

    dispatch(setPaymentInfo(initialPayment));
    const result = await createInitialPayment(initialPayment);

    if ('error' in result) {
      throw new Error(`error creating payment: ${JSON.stringify(result)}`);
    }

    const { data } = result;

    dispatch(setConfirmationStep(data));

    setLoading(false);
    navigateToRegPage('/finished');
  }

  if (!!loading) {
    return (
      <div className="payment-disable-overlay">
        <div>
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="payment-form" style={loading ? { pointerEvents: 'none' } : undefined}>
      <h3>Total: $0</h3>

      <button
        onClick={processResult}
        className="payby-check-button"
      >
        Finish Registration
      </button>
    </div>
  );
}

export default PaymentStepNoPayment;
