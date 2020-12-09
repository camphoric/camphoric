import React from 'react';
import {
  Switch,
  Redirect,
  useParams,
  useLocation,
} from 'react-router-dom';

import Spinner from '../../../Spinner';
import { useEvent } from '../../hooks';
import NavBar from './components/NavBar';

interface Props {
  authToken: string,
  location?: Object,
}

function EventAdmin(props: Props) {
  const { eventId } = useParams();
  const event = useEvent(eventId);

  if (!event) return <Spinner />;

  return (
    <div>
      <NavBar />
      <Switch>
        <h1>{event.name}</h1>
      </Switch>
    </div>
  );
}

export default EventAdmin;
