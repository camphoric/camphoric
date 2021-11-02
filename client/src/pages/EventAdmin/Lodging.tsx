import React from 'react';

interface Props {
  event: ApiEvent,
}

function EventAdminLodging({ event }: Props) {
  return (
    <React.Fragment>
      <h1>Lodging</h1>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminLodging;
