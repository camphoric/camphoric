import React from 'react';
import ShowRawJSON from './ShowRawJSON';

interface Props {
  registration: AugmentedRegistration;
}

function RegistrationEdit({ registration, ...props }: Props) {
  return (
    <ShowRawJSON label="registration" json={registration} />
  );
}

export default RegistrationEdit;
