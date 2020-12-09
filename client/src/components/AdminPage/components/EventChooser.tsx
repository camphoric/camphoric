import React from 'react';
import { Link, useLocation, } from 'react-router-dom';

import { useEvents } from '../hooks';
import Spinner from '../../Spinner';

interface Props {
  authToken: string,
  location?: Object,
}

function EventChooser(props: Props) {
  const { pathname } = useLocation();
  const events = useEvents();

  if (!events.length) return <Spinner />;

  return (
    <div>
      <ul>
        {
          events.map(
            (event) => (
              <li key={event.id}>
                <Link to={`${pathname}/${event.id}`}>
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
