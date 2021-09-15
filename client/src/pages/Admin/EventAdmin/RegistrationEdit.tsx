import React from 'react';
import ShowRawJSON from './ShowRawJSON';
// import { IChangeEvent, UiSchema } from '@rjsf/core';
import Form from '@rjsf/core';

interface Props {
  registration: AugmentedRegistration;
  event: ApiEvent,
}

function RegistrationEdit({ registration, event }: Props) {
  return (
    <div>
      <Form
        schema={event.registration_schema}
        formData={registration}
      />
      <ShowRawJSON label="registration" json={registration} />
    </div>
  );
}

export default RegistrationEdit;
