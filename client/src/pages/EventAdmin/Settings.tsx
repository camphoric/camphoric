import React from 'react';
import Spinner from 'components/Spinner';

function EventAdminSettings({ event }: EventAdminPageProps) {
  if (!event) return <Spinner />;

  return (
    <React.Fragment>
      <h1>Settings</h1>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminSettings;
