import React from 'react';
import {
  Switch,
  Route,
  Redirect,
  useLocation,
} from 'react-router-dom';

import { store as adminStore } from 'store/admin';
import { store as regStore } from 'store/register';
import { Provider } from 'react-redux';

import Default from 'components/Default';
import GuardedRoute from './GuardedRoute';

const RegistrationStep = React.lazy( () => import('pages/Register/RegistrationStep'));
const PaymentStep = React.lazy( () => import('pages/Register/PaymentStep'));
const ConfirmationStep = React.lazy( () => import('pages/Register/ConfirmationStep'));

const OrganizationChooser = React.lazy(() => import('pages/OrganizationChooser'));
const EventChooser = React.lazy(() => import('pages/EventChooser'));
const EventAdmin = React.lazy(() => import('./EventAdminContainer'));

//                        url     label   component
export type RouteTuple = [string, string, React.ComponentType<{}>];
export type RouteList = Array<RouteTuple>;
export const registerUrl = '/events/:eventId/register';

const RouterConfig = () => {
  const { pathname } = useLocation();

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      <Route path="/admin" render={() => (
        <Provider store={adminStore}>
          <GuardedRoute path="/admin">
            <Route exact path={['/admin', '/admin/organization/']}>
              <OrganizationChooser />
            </Route>
            <Route exact path="/admin/organization/:organizationId/event">
              <EventChooser />
            </Route>
            <Route path="/admin/organization/:organizationId/event/:eventId">
              <EventAdmin basePath="/admin/organization/:organizationId/event/:eventId" />
            </Route>
          </GuardedRoute>
        </Provider>
      )} />
      <Provider store={regStore}>
        <Route exact path="/" component={Default} />
        <Route exact path={registerUrl}>
          <Redirect to={`${pathname}/registration${window.location.search}`} />
        </Route>
        <Route exact path={`${registerUrl}/registration`} component={RegistrationStep} />
        <Route exact path={`${registerUrl}/payment`} component={PaymentStep} />
        <Route exact path={`${registerUrl}/finished`} component={ConfirmationStep} />
      </Provider>
    </Switch>
  );
};

export default RouterConfig;
