import React from 'react';
import {
  Switch,
  Redirect,
  useRouteMatch,
  useParams,
} from "react-router-dom";

import GuardedRouteFactory from './GuardedRoute';

import OrganizationChooser from './components/OrganizationChooser';
import EventChooser from './components/EventChooser';
import EventAdmin from './components/EventAdmin';

type RouteDuple = [string, () => JSX.Element];

function AdminPage (props: {}) {
  const { path } = useRouteMatch();
  const { organizationId } = useParams();

  const [authToken, setAuthToken] = React.useState(
    localStorage.getItem('AUTH_TOKEN') || ''
  );

  React.useEffect(() => {
    localStorage.setItem('AUTH_TOKEN', authToken);
  }, [authToken]);


  const subroutes: Array<RouteDuple> = [
    ['organization/:organizationId/event/:eventId', () => (<EventAdmin path={path} authToken={authToken} />)],
    ['organization/:organizationId/event', () => (<EventChooser path={path} authToken={authToken} />)],
    ['organization/:organizationId', () => (<Redirect to={`${path}/organization/${organizationId}/event`} />)],
    ['organization', () => (<OrganizationChooser path={path} authToken={authToken} />)],
  ];

  const GuardedRoute = GuardedRouteFactory(setAuthToken);

  return (
    <Switch>
      <GuardedRoute path={path} exact isAuthenticated={!!authToken}>
        <Redirect to={`${path}/organization`} />
      </GuardedRoute>
      {
        subroutes.map(
          ([route, Comp]) => (
            <GuardedRoute
              path={`${path}/${route}`}
              isAuthenticated={!!authToken}
              key={route}
            >
              <section> <Comp /> </section>
            </GuardedRoute>
          )
        )
      }
    </Switch>
  );
}

export default AdminPage;