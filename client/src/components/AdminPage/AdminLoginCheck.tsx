import React, { Suspense } from "react";
import Spinner from "../Spinner";

const Login = React.lazy(() => import('../Login'));
const AdminPage = React.lazy(() => import('./AdminPage'));

type AdminLoginCheckState = {
  authToken?: string,
  organizations?: Array<any>,
};

class AdminLoginCheck extends React.Component {
  state: AdminLoginCheckState = {
    organizations: undefined,
    authToken: undefined,
  };

  async getOrganizations() {
    let organizations
    try {
      const response = await fetch(
        '/api/organizations/',
      );

      organizations = await response.json();
    } catch (e) {

    }
    this.setState({ organizations });
  }

  render() {
    let pageContent: JSX.Element;

    if (!this.state.authToken) {
      pageContent = (
        <section className="Login">
          <Suspense fallback={<Spinner />}>
            <Login
              onLoginSuccess={(authToken) => this.setState({ authToken })}
              onLoginFail={(e) => { throw e; }}
            />
          </Suspense>
        </section>
      );
    } else {
      pageContent = (
        <section className="AdminPage">
          <Suspense fallback={<Spinner />}>
            <AdminPage
              authToken={this.state.authToken}
            />
          </Suspense>
        </section>
      );
    }

    return <div className="App">{pageContent}</div>;
  }
}

export default AdminLoginCheck;
