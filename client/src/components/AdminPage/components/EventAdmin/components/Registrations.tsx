import React from 'react';
// import {
//  InputGroup,
// } from 'react-bootstrap';

import ShowRawJSON from './ShowRawJSON';

import { useRegistrations, useCampers } from '../../../hooks';

interface Props {
  event?: ApiEvent,
}

function EventAdminRegistrations({ event }: Props) {
  const registrations = useRegistrations();
  const campers = useCampers();

  return (
    <React.Fragment>
      <ShowRawJSON label="registrations" json={registrations.value} />
      <ShowRawJSON label="campers" json={campers.value} />
    </React.Fragment>
  );
}

export default EventAdminRegistrations;
