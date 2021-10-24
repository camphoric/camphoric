import React from 'react';
import { Route, RouteProps } from 'react-router-dom';

import Login from './Login';
import { useUser } from 'hooks/admin';

type Props = Omit<RouteProps, 'component'>;

function GuardedRoute({ children, ...rest }: Props) {
  const userInfo = useUser();
  const user = userInfo.value;

  return (
    <Route {...rest} render={(props) => (
      user.loggedIn ? children : (
        <Login
          onLoginSuccess={userInfo.set}
          onLoginFail={(e) => console.log(e)}
        />
      )
    )} />
  );
}
export default GuardedRoute;
