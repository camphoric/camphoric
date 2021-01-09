import React from 'react';
import {
  Switch,
  Route,
  Redirect,
  useRouteMatch,
  useLocation,
} from 'react-router-dom';

import GuardedRoute from './GuardedRoute';

import OrganizationChooser from './OrganizationChooser';
import EventChooser from './EventChooser';
import EventAdmin from './EventAdmin';

type RouteDuple = [string, () => JSX.Element];

function AdminPage () {
  const { url } = useRouteMatch();
  const { pathname } = useLocation();

  const subroutes: Array<RouteDuple> = [
    ['organization/:organizationId/event/:eventId', EventAdmin],
    ['organization/:organizationId/event', EventChooser],
    ['organization', OrganizationChooser],
  ];

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      {
        subroutes.map(
          ([route, Comp]) => (
            <GuardedRoute path={`${url}/${route}`} key={route}>
              <Comp />
            </GuardedRoute>
          )
        )
      }
      <Route path="organization/:organizationId">
        <Redirect from={url} to={`${url}/event`} />
      </Route>
      <Redirect from={url} to={`${url}/organization`} />
    </Switch>
  );
}

export default AdminPage;
