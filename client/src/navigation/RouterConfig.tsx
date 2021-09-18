import React from 'react';
import {
  Switch,
  Route,
  Redirect,
  useLocation,
} from 'react-router-dom';

import Default from 'components/Default';

const RegisterPage = React.lazy(() => import('pages/Register'));

const OrganizationChooser = React.lazy(() => import('pages/OrganizationChooser'));
const EventChooser = React.lazy(() => import('pages/EventChooser'));
const EventAdmin = React.lazy(() => import('pages/EventAdmin'));

const RouterConfig = () => {
  const { pathname } = useLocation();

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      <Route exact path="/" component={Default} />
      <Route exact path="/events/:eventId/register" component={RegisterPage} />
      <Redirect exact from="/admin" to="/admin/organization" />

      <Route exact path="/admin/organization" component={OrganizationChooser} />
      <Redirect exact
        from="/admin/organization/:organizationId"
        to="/admin/organization/:organizationId/event"
      />
      <Route exact path="/admin/organization/:organizationId/event" component={EventChooser} />
      <Route path="/admin/organization/:organizationId/event/:eventId" component={EventAdmin} />
    </Switch>
  );
};

export default RouterConfig;
