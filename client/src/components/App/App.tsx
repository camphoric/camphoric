import "bootstrap/dist/css/bootstrap.min.css";
import React from "react";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";

import RegisterPage from "../RegisterPage";

const App = () => (
  <Router>
    <Route path="/" exact={true}>
      <h1>Camphoric!</h1>
      <Link to="/register">Registration Page</Link>
    </Route>
    <Route path="/register">
      <RegisterPage />
    </Route>
  </Router>
);

export default App;
