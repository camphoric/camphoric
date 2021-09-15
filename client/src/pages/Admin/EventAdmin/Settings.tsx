import React from 'react';

interface Props {
  event: ApiEvent,
}

function EventAdminSettings({ event }: Props) {
  return (
    <React.Fragment>
      <h1>Settings</h1>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminSettings;
