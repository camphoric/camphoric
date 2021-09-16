import React from 'react';
import {
  Switch,
  Route,
  Redirect,
  useRouteMatch,
  useLocation,
} from 'react-router-dom';

import Default from 'components/Default';

const AdminPage = React.lazy(() => import('pages/Admin'));
const RegisterPage = React.lazy(() => import('pages/Register'));

const OrganizationChooser = React.lazy(() => import('pages/Admin/OrganizationChooser'));
const EventChooser = React.lazy(() => import('pages/Admin/EventChooser'));
const EventAdmin = React.lazy(() => import('pages/Admin/EventAdmin'));

const RouterConfig = () => {
  const { url } = useRouteMatch();
  const { pathname } = useLocation();

  return (
    <Switch>
      <Redirect from="/:url*(/+)" to={pathname.slice(0, -1)} />
      <Route path="/" exact={true}>
        <Default />
      </Route>
      <Route path="/events/:eventId/register">
        <RegisterPage />
      </Route>
      <Route path="/admin">
        <AdminPage />
      </Route>

      <Route path='/admin/organization/:organizationId/event/:eventId'>
        <EventAdmin />
      </Route>
      <Route path='/admin/organization/:organizationId/event'>
        <EventChooser />
      </Route>
      <Route path='/admin/organization'>
        <OrganizationChooser />
      </Route>
      <Route path="/admin/organization/:organizationId">
        <Redirect from={url} to={`${url}/event`} />
      </Route>
      <Redirect from={url} to={`${url}/organization`} />
    </Switch>
  );
};

export default RouterConfig;
