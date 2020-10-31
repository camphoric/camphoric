import "bootstrap/dist/css/bootstrap.min.css";
import React, { Suspense } from "react";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import Spinner from "../Spinner";

const AdminPage = React.lazy(() => import('../AdminPage'));
const RegisterPage = React.lazy(() => import('../RegisterPage'));

const App = () => (
  <Router>
    <Route path="/" exact={true}>
      <h1>Camphoric!</h1>
      <p><Link to="/events/1/register">Registration Page (event 1)</Link></p>
      <p><Link to="/admin">Admin Page</Link></p>
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
