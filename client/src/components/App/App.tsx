import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Spinner from '../Spinner';

import Splash from './Splash';

const AdminPage = React.lazy(() => import('../AdminPage'));
const RegisterPage = React.lazy(() => import('../RegisterPage'));

const App = () => (
    <Router>
      <Route path="/" exact={true}>
        <Splash />
      </Route>
      <Route path="/events/:eventId/register">
        <Suspense fallback={<Spinner />}>
          <RegisterPage />
        </Suspense>
      </Route>
      <Route path="/admin">
        <Suspense fallback={<Spinner />}>
          <AdminPage />
        </Suspense>
      </Route>
    </Router>
);

export default App;
