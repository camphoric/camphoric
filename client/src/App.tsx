import React, { Suspense } from 'react';
import Spinner from 'components/Spinner';
import StateProvider from 'hooks/Provider';
import Router from 'navigation/Router';

import { UserInfo } from 'hooks/user';

const App = () => {
  const [csrfStatus, setCsrfStatus] = React.useState<'unfetched' | 'fetching' | 'set'>('unfetched');
  const [user, setUser] = React.useState<UserInfo | undefined | 'fetching'>(undefined);

  // set the CSRF cookie and user info before we do anything
  React.useEffect(() => {
    checkCsrf();

    function checkCsrf() {
      if (csrfStatus === 'fetching' ) return;
      if (csrfStatus === 'set') {
        getUser();
        return;
      }

      setCsrfStatus('fetching');

      fetch('/api/set-csrf-cookie').then(r => {
        if (!r.ok) throw new Error('got a bad response');

        return r.json();
      }).then((r) => {
        if (r?.detail !== 'CSRF cookie set') {
          throw new Error('got a bad response');
        }

        setCsrfStatus('set');
      }).catch(() => {

        // start over
        setCsrfStatus('unfetched');
      });
    }

    function getUser() {
      if (user !== undefined) return;

      setUser('fetching');

      fetch('/api/user').then(r => {
        if (!r.ok) throw new Error('got a bad response');

        return r.json();
      }).then(setUser).catch((e) => {
        // start over
        setUser(undefined);
      });
    }
  }, [csrfStatus, user]);

  // do not proceed without a CSRF cookie!
  if (csrfStatus !== 'set') return <Spinner />;
  // do not proceed without a login status!
  if (user === undefined || user === 'fetching') return <Spinner />;

  return (
    <StateProvider initialUser={user}>
      <Suspense fallback={<Spinner />}>
        <Router />
      </Suspense>
    </StateProvider>
  );
};

export default App;
