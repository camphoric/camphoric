import React from 'react';
import {
  Switch,
  Route,
  Redirect,
  useLocation,
} from 'react-router-dom';

import { store } from 'store/store';
import { Provider } from 'react-redux';

import Default from 'components/Default';
import GuardedRoute from './GuardedRoute';

const RegisterPage = React.lazy(() => import('pages/Register'));

const OrganizationChooser = React.lazy(() => import('pages/OrganizationChooser'));
const EventChooser = React.lazy(() => import('pages/EventChooser'));
const EventAdmin = React.lazy(() => import('./EventAdminContainer'));

//                        url     label   component
export type RouteTuple = [string, string, React.ComponentType<EventAdminPageProps>];
export type RouteList = Array<RouteTuple>;

const RouterConfig = () => {
  const { pathname } = useLocation();

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      <Route exact path="/" component={Default} />
      <Route exact path="/events/:eventId/register" component={RegisterPage} />
      <GuardedRoute path="/admin">
        <Provider store={store}>
          <Route exact path={['/admin', '/admin/organization/']}>
            <OrganizationChooser />
          </Route>
          <Route exact path="/admin/organization/:organizationId/event">
            <EventChooser />
          </Route>
          <Route path="/admin/organization/:organizationId/event/:eventId">
            <EventAdmin basePath="/admin/organization/:organizationId/event/:eventId" />
          </Route>
        </Provider>
      </GuardedRoute>
    </Switch>
  );
};

export default RouterConfig;
