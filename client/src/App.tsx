import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Spinner from 'components/Spinner';
import StateProvider from 'hooks/Provider';

import Default from 'components/Default';

const AdminPage = React.lazy(() => import('pages/Admin'));
const RegisterPage = React.lazy(() => import('pages/Register'));

const App = () => (
  <StateProvider>
    <Suspense fallback={<Spinner />}>
      <Router>
        <Route path="/" exact={true}>
          <Default />
        </Route>
        <Route path="/events/:eventId/register">
          <RegisterPage />
        </Route>
        <Route path="/admin">
          <AdminPage />
        </Route>
      </Router>
    </Suspense>
  </StateProvider>
);

export default App;
