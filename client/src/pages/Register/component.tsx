import React from 'react';
import { Helmet } from 'react-helmet';

import {
  PricingResults,
  FormData,
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm';

import InvitationInfo from './InvitationInfo';
import PaymentStep from './PaymentStep';
import RegisterStep from './RegisterStep';


import { type FormDataState } from './index';

interface Props {
  config: FormDataState['config'];
  step: FormDataState['step'];
  onChange: (a: JsonSchemaFormChangeEvent<FormData>) => void;
  onSubmit: (a: any) => Promise<void>;
  formData: FormDataState['formData'];
  totals: PricingResults;
}

function RegisterComponent(props: Props) {
  // TODO: maybe if the status is 'submitting', we can add a translucent grey
  // overlay add a spinner

  return (
    <section>
      <Helmet>
        <title>{props.config.dataSchema.title}</title>
      </Helmet>
      <div className="registration-form">
        <InvitationInfo config={props.config} />
        <RegisterStep {...props} />
        <PaymentStep {...props} />
      </div>
      <div className="PriceTicker">
        Total: ${(props.totals.total || 0).toFixed(2)}
      </div>
    </section>
  );
}

export default RegisterComponent;
