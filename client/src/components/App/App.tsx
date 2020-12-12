import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Spinner from '../Spinner';
import {
  OrganizationsContext,
  EventsContext,
  AuthContext,
} from '../AdminPage/hooks';

import Splash from './Splash';

const AdminPage = React.lazy(() => import('../AdminPage'));
const RegisterPage = React.lazy(() => import('../RegisterPage'));

type State = {
  authToken: {
    set: (value: string) => void,
    value: string,
  },
  events: {
    poll: () => Promise<any>,
    value: Array<ApiEvent>,
  },
  organizations: {
    poll: () => Promise<any>,
    value: Array<ApiOrganization>,
  },
}

class App extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);

    window.addEventListener('storage', this.authLocalStorageListener);

    this.state = {
      authToken: {
        set: this.setAuthToken,
        value: localStorage.getItem('AUTH_TOKEN') || ''
      },
      events: {
        poll: this.pollEvents,
        value: [],
      },
      organizations: {
        poll: this.pollOrganizations,
        value: [],
      },
    };
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.authLocalStorageListener);
  }

  setAuthToken = (value: string) => {
    const authToken = {
      set: this.setAuthToken,
      value: value,
    };

    localStorage.setItem('AUTH_TOKEN', value);
    this.setState({ authToken });
  }

  authLocalStorageListener = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    const newAuthToken = localStorage.getItem('AUTH_TOKEN') || '';
    if (newAuthToken === this.state.authToken.value) return;

    this.setAuthToken(newAuthToken);
  }

  pollOrganizations = async () => {
    const { authToken } = this.state;

    try {
      const response = await fetch(
        '/api/organizations/',
        {
          method: 'GET',
          headers: new Headers({
            'Authorization': `Token ${authToken.value}`, 
            'Content-Type': 'application/json'
          }),
        },
      );

      const value = await response.json();

      const organizations = {
        poll: this.pollOrganizations,
        value,
      };

      this.setState({ organizations });
    } catch (e) {
      console.error('error getting Organizations', e);
    }
  }

  pollEvents = async () => {
    const { authToken } = this.state;

    try {
      const response = await fetch(
        '/api/events/',
        {
          method: 'GET',
          headers: new Headers({
            'Authorization': `Token ${authToken.value}`, 
            'Content-Type': 'application/json'
          }),
        },
      );

      const value = await response.json();

      this.setState({
        events: {
          poll: this.pollEvents,
          value,
        },
      });
    } catch (e) {
      console.error('error getting Events', e);
    }
  }

  router() {
    return (
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
  }

  render() {
    return (
      <OrganizationsContext.Provider value={this.state.organizations}>
        <EventsContext.Provider value={this.state.events}>
          <AuthContext.Provider value={this.state.authToken}>
            {this.router()}
          </AuthContext.Provider>
        </EventsContext.Provider>
      </OrganizationsContext.Provider>
    );
  }
}

export default App;
