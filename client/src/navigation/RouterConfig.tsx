import React from 'react';
import {
  Switch,
  Route,
  Redirect,
  useLocation,
} from 'react-router-dom';

import Default from 'components/Default';
import GuardedRoute from './GuardedRoute';

const RegisterPage = React.lazy(() => import('pages/Register'));

const OrganizationChooser = React.lazy(() => import('pages/OrganizationChooser'));
const EventChooser = React.lazy(() => import('pages/EventChooser'));
const EventAdmin = React.lazy(() => import('./EventAdminContainer'));

const EventAdminHome = React.lazy(() => import('pages/EventAdminHome'));
const Registrations = React.lazy(() => import('pages/EventAdminRegistrations'));
const Lodging = React.lazy(() => import('pages/EventAdmin/Lodging'));
const Reports = React.lazy(() => import('pages/EventAdmin/Reports'));
const Settings = React.lazy(() => import('pages/EventAdmin/Settings'));

//                        url     label   component
export type RouteTuple = [string, string, React.ComponentType<EventAdminPageProps>];
export type RouteList = Array<RouteTuple>;

const eventAdminRoutes: RouteList = [
  ['home', 'Home', EventAdminHome],
  ['registrations', 'Registrations', Registrations],
  ['campers', 'Campers', Registrations],
  ['lodging', 'Lodging', Lodging],
  ['reports', 'Reports', Reports],
  ['settings', 'Settings', Settings],
];


const RouterConfig = () => {
  const { pathname } = useLocation();

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      <Route exact path="/" component={Default} />
      <Route exact path="/events/:eventId/register" component={RegisterPage} />
      <Redirect exact from="/admin" to="/admin/organization" />

      <GuardedRoute exact path="/admin/organization">
        <OrganizationChooser />
      </GuardedRoute>
      <Redirect exact
        from="/admin/organization/:organizationId"
        to="/admin/organization/:organizationId/event"
      />
      <GuardedRoute exact path="/admin/organization/:organizationId/event">
        <EventChooser />
      </GuardedRoute>
      <GuardedRoute path="/admin/organization/:organizationId/event/:eventId">
        <EventAdmin routes={eventAdminRoutes} />
      </GuardedRoute>
    </Switch>
  );
};

export default RouterConfig;
