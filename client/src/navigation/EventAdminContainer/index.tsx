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
  useEvent,
  useRegistrationLookup,
  useCamperLookup,
} from 'hooks/admin';

import EventAdminHome from 'pages/EventAdminHome';
import Registrations  from 'pages/EventAdminRegistrations';
import Campers        from 'pages/EventAdminCampers';
import Lodging        from 'pages/EventAdmin/Lodging';
import Reports        from 'pages/EventAdminReports';
import Settings       from 'pages/EventAdmin/Settings';

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



const basicSearchOptions = {
  isCaseSensitive: true,
  includeScore: true,
  shouldSort: true,
  includeMatches: true,
  // findAllMatches: false,
  minMatchCharLength: 3,
  location: 0,
  threshold: 0.6,
  distance: 100,
  // useExtendedSearch: false,
  // ignoreLocation: false,
  // ignoreFieldNorm: false,
};

const registrationSearchOptions = {
  ...basicSearchOptions,
  keys: [
    'registration_type',
    'campers.attributes.last_name',
    'campers.attributes.first_name',
    'attributes.payment.payer_last_name',
    'attributes.payment.payer_first_name',
    'attributes.payment.payer_number',
    'attributes.payment.payer_billing_address.city',
    'attributes.payment.payer_billing_address.country',
    'attributes.payment.payer_billing_address.zip_code',
    'attributes.payment.payer_billing_address.street_address',
    'attributes.payment.payer_billing_address.state_or_province',
  ]
}

const camperSearchOptions = {
  ...basicSearchOptions,
  keys: [
    'attributes.last_name',
    'attributes.first_name',
    'attributes.accommodations.accommodation_preference',
    'attributes.accommodations.camp_preference',
  ]
}



function EventAdmin() {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);
  const { pathname } = useLocation();
  const { url } = useRouteMatch();

  const registrationLookup = useRegistrationLookup(eventId || 0);
  const registrations = Object.values(registrationLookup);
  const registrationSearch = new Fuse<AugmentedRegistration>(
    registrations,
    registrationSearchOptions,
  );

  const camperLookup = useCamperLookup(eventId || 0);
  const campers = Object.values(camperLookup);
  const camperSearch = new Fuse<ApiCamper>(
    campers,
    camperSearchOptions,
  );

  if (!event) return <Spinner />;

  return(
    <Container>
      <Row className="justify-content-md-center"><Col>
      <NavBar routes={eventAdminRoutes} event={event} homeUrl="/admin/organization/:organizationId/event/:eventId/home" />
      <Switch>
        <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
        {
          eventAdminRoutes.map(
            ([route,, Comp]) => (
              <Route path={`${url}/${route}`} key={route}>
                <div className={`event-admin-section-${route}`}>
                  <Comp
                    event={event}
                    registrationLookup={registrationLookup}
                    registrationSearch={registrationSearch}
                    registrations={registrations}
                    camperLookup={camperLookup}
                    camperSearch={camperSearch}
                    campers={campers}
                  />
                </div>
              </Route>
            )
          )
        }
        <Redirect to={`${url}/home`} />
      </Switch>
    </Col></Row></Container>
  );
}

export default EventAdmin;
