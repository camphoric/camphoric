import React from 'react';
import { useParams } from 'react-router-dom';

import Spinner from '../../Spinner';

interface Props {
  authToken: string,
  path: string,
  location?: Object,
}

function EventAdmin(props: Props) {
  const [event, setEvent] = React.useState<ApiEvent>();
  const { eventId } = useParams();

  React.useEffect(() => {
    const getEvent = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}`,
          {
            method: 'GET',
            headers: new Headers({
              'Authorization': `Token ${props.authToken}`, 
              'Content-Type': 'application/json'
            }),
          },
        );

        const event = await response.json();

        setEvent(event);
      } catch (e) {
      }

    };

    getEvent();
  }, [props.authToken, eventId]);

  if (!event) return <Spinner />;

  return (
    <div>
      <h1>{event.name}</h1>
    </div>
  );
}

export default EventAdmin;
