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
import { useEvent, useCombinedEventInfo } from 'hooks/admin';

import NavBar from './NavBar';
import { RouteList } from '../RouterConfig';

import './styles.scss';

interface Props {
  routes: RouteList;
}

const registrationSearchOptions = {
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


function EventAdmin({ routes }: Props) {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);
  const { pathname } = useLocation();
  const { url } = useRouteMatch();

  const registrationLookup = useCombinedEventInfo(eventId || 0);
  const registrations = Object.values(registrationLookup);
  const registrationSearch = new Fuse<AugmentedRegistration>(
    registrations,
    registrationSearchOptions,
  );

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
              <Route path={`${url}/${route}`} key={route}>
                <div className={`event-admin-section-${route}`}>
                  <Comp
                    event={event}
                    registrationLookup={registrationLookup}
                    registrationSearch={registrationSearch}
                    registrations={registrations}
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
