import React from 'react';

import { type ErrorTransformer } from '@rjsf/utils';

import JsonSchemaForm from 'components/JsonSchemaForm';
import Template from 'components/Template';

import type { RegisterStepProps } from './component';
import RegistrationClosed from './RegistrationClosed';
import transformErrorsCreator from './transformErrors';

function RegistrationStep(props: RegisterStepProps) {
  const [liveValidate, setLiveValidate] = React.useState(false);

  if (props.step !== 'registration') return null;

  if (!props.config.event.is_open && !props.config.invitation) {
    return <RegistrationClosed {...props} />;
  }

  const transformErrors = transformErrorsCreator(props.config.dataSchema) as ErrorTransformer;

  // @ts-ignore
  const onJsonSchemaFormError = (...args) => {
    setLiveValidate(true);

    // @ts-ignore
    return props.onJsonSchemaFormError(...args);
  }
  

  return (
    <React.Fragment>
      <JsonSchemaForm
        schema={props.config.dataSchema}
        uiSchema={props.config.uiSchema}
        onChange={props.onChange}
        onSubmit={props.submitRegistration}
        onError={onJsonSchemaFormError}
        formData={props.formData}
        /*
        // @ts-ignore */
        transformErrors={transformErrors}

        templateData={{
          pricing: props.config.pricing,
          formData: props.formData,
          totals: props.totals,
        }}
        noHtml5Validate
        liveValidate={liveValidate}
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
