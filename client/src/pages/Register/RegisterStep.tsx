import React from 'react';

import JsonSchemaForm from 'components/JsonSchemaForm';
import Template from 'components/Template';

import type { RegisterStepProps } from './component';
import RegistrationClosed from './RegistrationClosed';

function RegistrationStep(props: RegisterStepProps) {
  if (props.step !== 'registration') return null;

  if (!props.config.event.is_open && !props.config.invitation) {
    return <RegistrationClosed {...props} />;
  }

  const transformErrors = (errors: Array<any>) =>
    errors.map(error => {
      if (error.name === "pattern" && error.property === ".payer_number") {
        return {
          ...error,
          message: "Please enter a valid phone number"
        };
      }

      return error;
    });


  return (
    <React.Fragment>
      <JsonSchemaForm
        schema={props.config.dataSchema}
        uiSchema={props.config.uiSchema}
        onChange={props.onChange}
        onSubmit={props.submitRegistration}
        onError={props.onJsonSchemaFormError}
        formData={props.formData}
        transformErrors={transformErrors}

        templateData={{
          pricing: props.config.pricing,
          formData: props.formData,
          totals: props.totals,
        }}
        // liveValidate={true}
      >
        <div>
          <Template markdown={props.config.preSubmitTemplate} />
          <button type="submit" className="btn btn-info">
            Continue to payment
          </button>
        </div>
      </JsonSchemaForm>
    </React.Fragment>
  );
}

export default RegistrationStep;
