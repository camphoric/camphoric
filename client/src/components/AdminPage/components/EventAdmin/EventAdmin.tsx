import React from 'react';
import {
  Switch,
  Redirect,
  useParams,
  useRouteMatch,
  useLocation,
} from 'react-router-dom';

import Spinner from '../../../Spinner';
import GuardedRoute from '../../GuardedRoute';
import { useEvent } from '../../hooks';
import NavBar from './components/NavBar';
//                        rel-url label         component
type RouteTuple = [string, string, () => JSX.Element];
export type RouteList = Array<RouteTuple>

function EventAdmin() {
  const { eventId } = useParams();
  const { pathname } = useLocation();
  const { url } = useRouteMatch();
  const event = useEvent(eventId);

  if (!event) return <Spinner />;

  const subroutes: RouteList = [
    ['home', 'Home', () => <div>Home</div>],
    ['registrations', 'Registrations', () => <div>Registrations</div>],
    ['lodging', 'Lodging', () => <div>Lodging</div>],
    ['reports', 'Reports', () => <div>Reports</div>],
    ['settings', 'Settings', () => <div>Settings</div>],
  ];

  return (
    <div>
      <h1>{event.name}</h1>
      <NavBar routes={subroutes} />
      <Switch>
        <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
        {
          subroutes.map(
            ([route,, Comp]) => (
              <GuardedRoute path={`${url}/${route}`} key={route}>
                <section> <Comp /> </section>
              </GuardedRoute>
            )
          )
        }
      <Redirect from={url} to={`${url}/home`} />
      </Switch>
    </div>
  );
}

export default EventAdmin;
