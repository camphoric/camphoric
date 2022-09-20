import React from 'react';
import {
  Switch,
  Redirect,
  Route,
} from 'react-router-dom';
import { IconContext } from 'react-icons';

import { Container, Row, Col } from 'react-bootstrap';

import EventAdminHome from 'pages/EventAdminHome';
import Registrations  from 'pages/EventAdminRegistrations';
import Campers        from 'pages/EventAdminCampers';
import Lodging        from 'pages/EventAdminLodging';
import Reports        from 'pages/EventAdminReports';
import Settings       from 'pages/EventAdminSettings';

import NavBar from './NavBar';
import { RouteList } from '../RouterConfig';

const eventAdminRoutes: RouteList = [
  ['home', 'Home', EventAdminHome],
  ['registrations', 'Registrations', Registrations],
  ['campers', 'Campers', Campers],
  ['lodging', 'Lodging', Lodging],
  ['reports', 'Reports', Reports],
  ['settings', 'Settings', Settings],
];

function EventAdmin(props: { basePath: string }) {
  return(
    <IconContext.Provider value={{
      className: 'react-icons',
      size: '1.5rem',
    }}>
      <Container>
        <Row className="justify-content-md-center admin-container"><Col>
        <NavBar routes={eventAdminRoutes} />
        <Switch>
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
    </IconContext.Provider>
  );
}

export default EventAdmin;
