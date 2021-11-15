import React from 'react';
import { useParams } from 'react-router-dom';
import Form from '@rjsf/core';

import { useEvent } from 'hooks/admin';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';

interface Props {
  registration: AugmentedRegistration;
}

function RegistrationEdit({ registration }: Props) {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);

  if (!event) return <Spinner />;

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
