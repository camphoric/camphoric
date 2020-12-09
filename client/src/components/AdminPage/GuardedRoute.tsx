import React from 'react';
import { Route } from 'react-router-dom';

import Login from './components/Login';
import { useAuthToken } from './hooks';


type Props =  {
  children: React.ReactNode,
  path: string,
  exact?: boolean,
};

function GuardedRoute({ children, ...rest }: Props) {
  const authToken = useAuthToken();

  return (
    <Route {...rest} render={(props) => (
      authToken.value ? children : (
        <Login
          onLoginSuccess={authToken.set}
          onLoginFail={(e) => console.log(e)}
        />
      )
    )} />
  );
}
export default GuardedRoute;
