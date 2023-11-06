import React from 'react';
import { Link, useLocation, } from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import Spinner from 'components/Spinner';
import api, { useUrlParams } from 'hooks/api';

function EventChooser() {
  const { pathname } = useLocation();
  const { organizationId } = useUrlParams();
  const eventsApi = api.useGetEventsQuery();

  if (eventsApi.isFetching || eventsApi.isLoading) return <Spinner />;
  if (!organizationId) return <Spinner />;

  const events = (eventsApi.data || []).filter(
    (e) => e.organization.toString() === organizationId
  );

  return (
    <Container><Row className="justify-content-md-center"><Col>
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
    </Col></Row></Container>
  );
}

export default EventChooser;
