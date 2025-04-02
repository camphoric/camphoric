import React from 'react';
import Spinner from 'components/Spinner';
import api from 'store/register/api';
import {
  useRegFormData,
} from 'store/register/store';

import PageWrapper from '../PageWrapper';
import PaymentStepPaymentNeeded from './PaymentStepPaymentNeeded';
import PaymentStepNoPayment from './PaymentStepNoPayment';

function PaymentStep() {
  const registrationApi = api.useGetRegistrationQuery();
  const regFormData = useRegFormData();

  if (
    registrationApi.isFetching ||
    registrationApi.isLoading ||
    !registrationApi.data ||
    !regFormData.paymentStep
  ) return <Spinner />;

  const total = regFormData.paymentStep.serverPricingResults.total || 0;

  return (
    <PageWrapper>
      {
        total > 0 ? (
          <PaymentStepPaymentNeeded />
        ) : (
          <PaymentStepNoPayment />
        )
      }
    </PageWrapper>
  );
}

export default PaymentStep;
