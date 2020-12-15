import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Spinner from '../Spinner';
import {
  AuthContext,
  OrganizationsContext,
  EventsContext,
  RegistrationsContext,
  CampersContext,
  ContextValue,
} from '../AdminPage/hooks';

import Splash from './Splash';

const AdminPage = React.lazy(() => import('../AdminPage'));
const RegisterPage = React.lazy(() => import('../RegisterPage'));

type ApiEndpoint = 'events' | 'organizations' | 'registrations' | 'campers';

type State = {
  authToken: {
    set: (value: string) => void,
    value: string,
  },
  events: ContextValue<ApiEvent>,
  organizations: ContextValue<ApiOrganization>,
  registrations: ContextValue<ApiRegistration>,
  campers: ContextValue<ApiCamper>,
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
        get: this.getFactory<ApiEvent>('events'),
        value: [],
        status: 'undef',
      },
      organizations: {
        get: this.getFactory<ApiOrganization>('organizations'),
        value: [],
        status: 'undef',
      },
      registrations: {
        get: this.getFactory<ApiRegistration>('registrations'),
        value: [],
        status: 'undef',
      },
      campers: {
        get: this.getFactory<ApiCamper>('campers'),
        value: [],
        status: 'undef',
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

  async apiFetch<P>(endpoint: ApiEndpoint): Promise<P[]> {
    const { authToken } = this.state;
    let value = [];

    try {
      const response = await fetch(
        `/api/${endpoint}/`,
        {
          method: 'GET',
          headers: new Headers({
            'Authorization': `Token ${authToken.value}`, 
            'Content-Type': 'application/json'
          }),
        },
      );

      value = await response.json();
    } catch (e) {
      console.error(`error getting ${endpoint}`, e);
    }

    return value;
  }


  getFactory<P>(endpoint: ApiEndpoint) {
    return () => this.setState((prevState: State) => ({
      ...prevState,
      [endpoint]: {
        ...prevState[endpoint],
        status: 'fetching',
      }
    }), async () => {
      const value = await this.apiFetch<P>(endpoint);

      this.setState((prevState: State) => ({
        ...prevState,
        [endpoint]: {
          get: this.getFactory(endpoint),
          value,
          status: 'done',
        },
      }));
    });
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
      <CampersContext.Provider value={this.state.campers}>
        <RegistrationsContext.Provider value={this.state.registrations}>
          <OrganizationsContext.Provider value={this.state.organizations}>
            <EventsContext.Provider value={this.state.events}>
              <AuthContext.Provider value={this.state.authToken}>
                {this.router()}
              </AuthContext.Provider>
            </EventsContext.Provider>
          </OrganizationsContext.Provider>
        </RegistrationsContext.Provider>
      </CampersContext.Provider>
    );
  }
}

export default App;
