import React from 'react';
import { useParams } from 'react-router-dom';

import { useEvent } from 'hooks/admin';
import Spinner from 'components/Spinner';

function EventAdminReports() {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);

  if (!event) return <Spinner />;

  return (
    <React.Fragment>
      <h1>Reports</h1>
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </React.Fragment>
  );
}

export default EventAdminReports;