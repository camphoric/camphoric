import React from 'react';
import {
  Switch,
  Redirect,
  useParams,
  useLocation,
} from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import Spinner from 'components/Spinner';
import GuardedRoute from 'navigation/GuardedRoute';
import { useEvent } from 'hooks/admin';

import NavBar from './NavBar';
import { RouteList } from '../RouterConfig';

import './styles.scss';

interface Props {
  routes: RouteList;
}

function EventAdmin({ routes }: Props) {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);
  const { pathname } = useLocation();

  if (!event) return <Spinner />;

  return(
    <Container>
      <Row className="justify-content-md-center"><Col>
      <NavBar routes={routes} event={event} homeUrl="/admin/organization/:organizationId/event/:eventId/home" />
      <Switch>
        <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
        {
          routes.map(
            ([route,, Comp]) => (
              <GuardedRoute path={route} key={route}>
                <div className={`event-admin-section-${route}`}><Comp /></div>
              </GuardedRoute>
            )
          )
        }
        <Redirect to="/admin/organization/:organizationId/event/:eventId/home" />
      </Switch>
    </Col></Row></Container>
  );
}

export default EventAdmin;
