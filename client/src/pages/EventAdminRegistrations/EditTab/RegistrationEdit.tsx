import React from 'react';

import JsonSchemaForm from 'components/JsonSchemaForm';
import ShowRawJSON from 'components/ShowRawJSON';

interface Props {
  registration: AugmentedRegistration;
  event: ApiEvent,
}

function RegistrationEdit({ registration, event }: Props) {
  return (
    <div>
      <JsonSchemaForm
        schema={event.registration_schema}
        uiSchema={event.registration_ui_schema}
        formData={registration.attributes}
        templateData={{
          pricing: event.pricing,
          formData: registration.attributes,
          totals: registration.server_pricing_results,
        }}
      />
      <ShowRawJSON label="registration" json={registration} />
    </div>
  );
}

export default RegistrationEdit;
