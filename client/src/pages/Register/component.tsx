import React from 'react';
import { Helmet } from 'react-helmet';

import {
  PricingResults,
  FormData,
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm';
import ErrorBoundary from 'components/ErrorBoundary';

import InvitationInfo from './InvitationInfo';
import PaymentStep from './PaymentStep';
import RegisterStep from './RegisterStep';


import type { 
  FormDataState,
  SubmitPaymentMethod,
  SubmitRegistrationMethod,
} from './index';

export interface RegisterStepProps {
  config: FormDataState['config'];
  step: FormDataState['step'];
  onChange: (a: JsonSchemaFormChangeEvent<FormData>) => void;
  onBlur: (a: string, b: string) => void;
  submitRegistration: SubmitRegistrationMethod;
  submitPayment: SubmitPaymentMethod;
  onJsonSchemaFormError: (a: any) => void;
  formData: FormDataState['formData'];
  totals: PricingResults;
  UUID?: string;
}

function RegisterComponent(props: RegisterStepProps) {
  // TODO: maybe if the status is 'submitting', we can add a translucent grey
  // overlay add a spinner

  return (
    <section>
      <Helmet>
        <title>{props.config.dataSchema.title}</title>
      </Helmet>
      <div className="registration-form">
        <ErrorBoundary section="InvitationInfo">
          <InvitationInfo config={props.config} />
        </ErrorBoundary>
        <ErrorBoundary section="RegisterStep">
          <RegisterStep {...props} />
        </ErrorBoundary>
        <ErrorBoundary section="PaymentStep">
          <PaymentStep {...props} />
        </ErrorBoundary>
      </div>
      <div className="PriceTicker">
        Total: ${(props.totals.total || 0).toFixed(2)}
      </div>
    </section>
  );
}

export default RegisterComponent;
