import React from 'react';

function EventAdminLodging({ event }: EventAdminPageProps) {
  return (
    <React.Fragment>
      <h1>Lodging</h1>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminLodging;
