import React from 'react';
import {
  Switch,
  Redirect,
  useParams,
  useRouteMatch,
  useLocation,
} from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import Spinner from 'components/Spinner';
import GuardedRoute from '../GuardedRoute';
import { useEvent } from 'hooks/admin';

import NavBar from './NavBar';
import Home from './Home';
import Registrations from './Registrations';
import Lodging from './Lodging';
import Reports from './Reports';
import Settings from './Settings';

import './styles.scss';

//                 rel-url label         component
type RouteTuple = [string, string, () => JSX.Element];
export type RouteList = Array<RouteTuple>

function EventAdmin() {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);
  const { pathname } = useLocation();
  const { url } = useRouteMatch();

  if (!event) return <Spinner />;

  const subroutes: RouteList = [
    ['home', 'Home', () => <Home event={event} />],
    ['registrations', 'Registrations', () => <Registrations event={event} />],
    ['campers', 'Campers', () => <Registrations event={event} />],
    ['lodging', 'Lodging', () => <Lodging event={event} />],
    ['reports', 'Reports', () => <Reports event={event} />],
    ['settings', 'Settings', () => <Settings event={event} />],
  ];

  return (
    <Container>
      <Row className="justify-content-md-center"><Col>
      <NavBar url={url} routes={subroutes} event={event} homeUrl={`${url}/home`} />
      <Switch>
        <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
        {
          subroutes.map(
            ([route,, Comp]) => (
              <GuardedRoute path={`${url}/${route}`} key={route}>
                <div className={`event-admin-section-${route}`}><Comp /></div>
              </GuardedRoute>
            )
          )
        }
        <Redirect to={`${url}/home`} />
      </Switch>
    </Col></Row></Container>
  );
}

export default EventAdmin;
