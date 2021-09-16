import React, { Suspense } from 'react';
import Spinner from 'components/Spinner';
import StateProvider from 'hooks/Provider';
import Router from 'navigation/Router';

const App = () => (
  <StateProvider>
    <Suspense fallback={<Spinner />}>
      <Router />
    </Suspense>
  </StateProvider>
);

export default App;
