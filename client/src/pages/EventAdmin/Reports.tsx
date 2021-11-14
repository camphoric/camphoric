import React from 'react';
import Spinner from 'components/Spinner';

function EventAdminReports({ event }: EventAdminPageProps) {
  if (!event) return <Spinner />;

  return (
    <React.Fragment>
      <h1>Reports</h1>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminReports;
