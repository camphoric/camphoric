import React from 'react';

import { type FormDataState } from './index';

import JsonSchemaForm, {
  PricingResults,
  FormData,
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm';

interface Props {
  config: FormDataState['config'];
  step: FormDataState['step'];
  onChange: (a: JsonSchemaFormChangeEvent<FormData>) => void;
  onSubmit: (a: any) => Promise<void>;
  formData: FormDataState['formData'];
  totals: PricingResults;
}

function RegistrationStep(props: Props) {
  if (props.step !== 'registration') return null;

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
        onSubmit={props.onSubmit}
        onError={() => console.log("errors")}
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
          <p>
            By submitting this form, you agree to the{" "}
            <a
              href="http://www.larkcamp.org/campterms.html"
              target="_blank"
              rel="noreferrer"
            >
              Terms of Registration
            </a>
          </p>
          <button type="submit" className="btn btn-info">
            Continue to payment
          </button>
        </div>
      </JsonSchemaForm>
    </React.Fragment>
  );
}

export default RegistrationStep;
