import React from 'react';
import { Link, useLocation, } from 'react-router-dom';

import Spinner from '../../Spinner';

interface Props {
  authToken: string,
  location?: Object,
}

function EventChooser(props: Props) {
  const [events, setEvents] = React.useState<ApiEvent[]>([]);
  const { pathname } = useLocation();

  React.useEffect(() => {
    const getEvents = async () => {
      try {
        const response = await fetch(
          '/api/events/',
          {
            method: 'GET',
            headers: new Headers({
              'Authorization': `Token ${props.authToken}`, 
              'Content-Type': 'application/json'
            }),
          },
        );

        const events = await response.json();

        setEvents(events);
      } catch (e) {
        // TODO: create some sort of dev level logging
      }

    };

    getEvents();
  }, [props.authToken]);

  if (!events.length) return <Spinner />;

  return (
    <div>
      <ul>
        {
          events.map(
            (event) => (
              <li key={event.id}>
                <Link to={`${pathname}${event.id}`}>
                  {event.name}
                </Link>
              </li>
            )
          )
        }
      </ul>
    </div>
  );
}

export default EventChooser;
