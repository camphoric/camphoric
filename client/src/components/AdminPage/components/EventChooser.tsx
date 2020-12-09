import React from 'react';
import { Link, useLocation, } from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import { useEvents } from '../hooks';
import Spinner from '../../Spinner';

function EventChooser() {
  const { pathname } = useLocation();
  const events = useEvents();

  if (!events.value.length) return <Spinner />;

  return (
    <Container><Row className="justify-content-md-center"><Col>
      <ul>
        {
          events.value.map(
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
    </Col></Row></Container>
  );
}

export default EventChooser;
