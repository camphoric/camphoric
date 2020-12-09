import React from 'react';
import {
  Switch,
  Redirect,
  useParams,
  useLocation,
} from 'react-router-dom';

import Spinner from '../../../Spinner';
import NavBar from './components/NavBar';

interface Props {
  authToken: string,
  location?: Object,
}

function EventAdmin(props: Props) {
  const { eventId } = useParams();

  const [event, setEvent] = React.useState<ApiEvent>();

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
      <NavBar />
      <section>
        <h1>{event.name}</h1>
      </section>
    </div>
  );
}

export default EventAdmin;
