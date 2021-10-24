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

const Home = React.lazy(() => import('pages/EventAdmin/Home'));
const Registrations = React.lazy(() => import('pages/EventAdmin/Registrations'));
const Lodging = React.lazy(() => import('pages/EventAdmin/Lodging'));
const Reports = React.lazy(() => import('pages/EventAdmin/Reports'));
const Settings = React.lazy(() => import('pages/EventAdmin/Settings'));

//                        url     label   component
export type RouteTuple = [string, string, React.ComponentType];
export type RouteList = Array<RouteTuple>;

const eventAdminRoutes: RouteList = [
  ['/admin/organization/:organizationId/event/:eventId/home', 'Home', Home],
  ['/admin/organization/:organizationId/event/:eventId/registrations', 'Registrations', Registrations],
  ['/admin/organization/:organizationId/event/:eventId/campers', 'Campers', Registrations],
  ['/admin/organization/:organizationId/event/:eventId/lodging', 'Lodging', Lodging],
  ['/admin/organization/:organizationId/event/:eventId/reports', 'Reports', Reports],
  ['/admin/organization/:organizationId/event/:eventId/settings', 'Settings', Settings],
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
