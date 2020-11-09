import React from 'react';
import { Route } from 'react-router-dom';

import Login from './components/Login';


type Props =  {
  isAuthenticated: boolean,
  children: React.ReactNode,
  path: string,
  exact?: boolean,
};

const GuardedRouteFactory =
  (setAuthToken: (authToken: string) => void) =>
  ({ isAuthenticated, children, ...rest }: Props) => (
    <Route {...rest} render={(props) => (
        isAuthenticated === true
            ? children
            : (
              <Login
                onLoginSuccess={setAuthToken}
                onLoginFail={(e) => console.log(e)}
              />
            )

    )} />
)

export default GuardedRouteFactory;
