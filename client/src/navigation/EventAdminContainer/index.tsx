import React from 'react';
import {
  Switch,
  Redirect,
  Route,
  useParams,
  useLocation,
  useRouteMatch,
} from 'react-router-dom';

import { Container, Row, Col } from 'react-bootstrap';
import Fuse from 'fuse.js';

import Spinner from 'components/Spinner';

import {
  useRegistrationLookup,
  useRegistrationSearch,
  useCamperLookup,
  useCamperSearch,
  useEvent,
  useOrganization,
} from 'store/hooks';

import api from 'store/api';

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

  const eventApi = useEvent();
  const organizationApi = useOrganization();
  const registrations = api.useGetRegistrationsQuery();
  const registrationLookup = useRegistrationLookup();
  const registrationSearch = useRegistrationSearch();

  const campers = api.useGetCampersQuery();
  const camperLookup = useCamperLookup();
  const camperSearch = useCamperSearch();

  if (eventApi.isLoading || eventApi.isFetching) return <Spinner />;

  const event = eventApi.data;

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
