import React from 'react';
import {
  Switch,
  Redirect,
  Route,
  useLocation,
} from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';

import EventAdminHome from 'pages/EventAdminHome';
import Registrations  from 'pages/EventAdminRegistrations';
import Campers        from 'pages/EventAdminCampers';
import Lodging        from 'pages/EventAdmin/Lodging';
import Reports        from 'pages/EventAdminReports';
import Settings       from 'pages/EventAdminSettings';

import NavBar from './NavBar';
import { RouteList } from '../RouterConfig';

import './styles.scss';

const eventAdminRoutes: RouteList = [
  ['home', 'Home', EventAdminHome],
  ['registrations', 'Registrations', Registrations],
  ['campers', 'Campers', Campers],
  ['lodging', 'Lodging', Lodging],
  ['reports', 'Reports', Reports],
  ['settings', 'Settings', Settings],
];

function EventAdmin(props: { basePath: string }) {
  const { pathname } = useLocation();

  return(
    <Container>
      <Row className="justify-content-md-center"><Col>
      <NavBar routes={eventAdminRoutes} />
      <Switch>
        <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
        {
          eventAdminRoutes.map(
            ([route,, Comp]) => (
              <Route path={`${props.basePath}/${route}`} key={route}>
                <div className={`event-admin-section-${route}`}>
                  <Comp />
                </div>
              </Route>
            )
          )
        }
        <Redirect to={`${props.basePath}/home`} />
      </Switch>
    </Col></Row></Container>
  );
}

export default EventAdmin;
