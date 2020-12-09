import React from 'react';
import {
  Switch,
  Redirect,
  useRouteMatch,
  useParams,
  useLocation,
} from 'react-router-dom';

import GuardedRoute from './GuardedRoute';

import OrganizationChooser from './components/OrganizationChooser';
import EventChooser from './components/EventChooser';
import EventAdmin from './components/EventAdmin';

type RouteDuple = [string, () => JSX.Element];

function AdminPage () {
  const { url } = useRouteMatch();
  const { pathname } = useLocation();
  const { organizationId } = useParams<RouterUrlParams>();

  const subroutes: Array<RouteDuple> = [
    ['organization/:organizationId/event/:eventId', () => (<EventAdmin />)],
    ['organization/:organizationId/event', () => (<EventChooser />)],
    ['organization/:organizationId', () => (<Redirect to={`${url}/organization/${organizationId}/event`} />)],
    ['organization', () => (<OrganizationChooser />)],
  ];

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      {
        subroutes.map(
          ([route, Comp]) => (
            <GuardedRoute path={`${url}/${route}`} key={route}>
              <section> <Comp /> </section>
            </GuardedRoute>
          )
        )
      }
      <Redirect from={url} to={`${url}/organization`} />
    </Switch>
  );
}

export default AdminPage;
