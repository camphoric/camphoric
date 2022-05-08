import React from 'react';
import { useEvent } from 'hooks/api';
import Spinner from 'components/Spinner';

function EventAdminLodging() {
  const eventApi = useEvent();

  if (eventApi.isLoading || !eventApi.data) return <Spinner />;

  return (
    <React.Fragment>
      <h1>Lodging</h1>
      <pre>{JSON.stringify(eventApi.data, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminLodging;
