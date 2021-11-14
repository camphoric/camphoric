import React from 'react';

import JsonSchemaForm, {
  //  calculatePrice,
  //  PricingResults,
  //  FormData,
  //  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm';

import ShowRawJSON from 'components/ShowRawJSON';

interface Props {
  camper: ApiCamper;
  event: ApiEvent,
}

function CamperEdit({ camper, event }: Props) {
  // Typescript is dumb sometimes...
  const camperUISchema = (event.registration_ui_schema as any).campers;

  return (
    <div>
      <JsonSchemaForm
        schema={{
          definitions: event.registration_schema.definitions,
          ...event.camper_schema
        }}
        uiSchema={camperUISchema}
        formData={camper.attributes}
        templateData={{
          pricing: event.pricing,
          formData: camper.attributes,
        }}
      />
      <ShowRawJSON label="camper" json={camper} />
    </div>
  );
}

export default CamperEdit;
