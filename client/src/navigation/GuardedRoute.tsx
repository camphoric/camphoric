import React from 'react';
import { Route, RouteProps } from 'react-router-dom';

import Spinner from 'components/Spinner';
import api from 'store/admin/api';

import Login from './Login';

type Props = Omit<RouteProps, 'component'>;

function GuardedRoute({ children, ...rest }: Props) {
  const userApi = api.useGetCurrentUserQuery();

  if (!userApi.data) return (<Spinner />);

  const user = userApi.data;

  return (
    <Route {...rest} render={() => (
      user.username ? children : <Login />
    )} />
  );
}

export default GuardedRoute;
