import React from 'react';

import type { RegisterStepProps } from './component';

function RegistrationClosed(props: RegisterStepProps) {
  console.log(props);
  return (
    <>
      <h1>Registration Closed</h1>
      Hope to see you next time!
    </>
  );
}

export default RegistrationClosed;
