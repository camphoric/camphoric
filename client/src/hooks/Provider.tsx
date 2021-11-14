import React from 'react';
import {
  UserContext,
  OrganizationsContext,
  EventsContext,
  RegistrationsContext,
  CampersContext,
  ContextValue,
  UserInfo,
  MinimumApiObject,
  unauthenticatedUser,
} from './admin';

type ApiEndpoint = 'events' | 'organizations' | 'registrations' | 'campers';

type State = {
  user: {
    set: (value: UserInfo) => void,
    value: UserInfo,
  },
  events: ContextValue<ApiEvent>,
  organizations: ContextValue<ApiOrganization>,
  registrations: ContextValue<ApiRegistration>,
  campers: ContextValue<ApiCamper>,
}

type Props = {
  initialUser: UserInfo,
}

export default class StateProvider extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      user: {
        set: this.setUser,
        value: this.props.initialUser,
      },
      events: {
        get: this.getFactory<ApiEvent>('events'),
        set: this.setFactory<ApiEvent>('events'),
        value: [],
        status: 'undef',
      },
      organizations: {
        get: this.getFactory<ApiOrganization>('organizations'),
        set: this.setFactory<ApiOrganization>('organizations'),
        value: [],
        status: 'undef',
      },
      registrations: {
        get: this.getFactory<ApiRegistration>('registrations'),
        set: this.setFactory<ApiRegistration>('registrations'),
        value: [],
        status: 'undef',
      },
      campers: {
        get: this.getFactory<ApiCamper>('campers'),
        set: this.setFactory<ApiCamper>('campers'),
        value: [],
        status: 'undef',
      },
    };
  }

  setUser = (value: UserInfo) => {
    const user = {
      set: this.setUser,
      value,
    };

    this.setState({ user });
  }

  async apiFetch<P extends MinimumApiObject>(endpoint: ApiEndpoint): Promise<P[]> {
    let value = [];

    try {
      const response = await fetch(
        `/api/${endpoint}/`,
        {
          method: 'GET',
          headers: new Headers({
            'Content-Type': 'application/json'
          }),
        },
      );

      if (response.status === 401) this.setUser(unauthenticatedUser);

      value = await response.json();
    } catch (e) {
      console.error(`error getting ${endpoint}`, e);
    }

    return value;
  }

  async apiPut<P extends MinimumApiObject>(endpoint: ApiEndpoint, value: P): Promise<void> {
    try {
      const response = await fetch(
        `/api/${endpoint}/${value.id}`,
        {
          method: 'PUT',
          headers: new Headers({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify(value),
        },
      );

      if (response.status === 401) this.setUser(unauthenticatedUser);

    } catch (e) {
      console.error(`error getting ${endpoint}`, e);
    }
  }

  getFactory<P extends MinimumApiObject>(endpoint: ApiEndpoint) {
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
          set: this.setFactory(endpoint),
          value,
          status: 'done',
        },
      }));
    });
  }

  setFactory<P extends MinimumApiObject>(endpoint: ApiEndpoint) {
    return (newValue: P) => this.setState((prevState: State) => ({
      ...prevState,
      [endpoint]: {
        ...prevState[endpoint],
        status: 'setting',
      }
    }), async () => {
      await this.apiPut<P>(endpoint, newValue);
      await this.state[endpoint].get();
    });
  }

  render() {
    return (
      <UserContext.Provider value={this.state.user}>
        <CampersContext.Provider value={this.state.campers}>
          <RegistrationsContext.Provider value={this.state.registrations}>
            <OrganizationsContext.Provider value={this.state.organizations}>
              <EventsContext.Provider value={this.state.events}>
                {this.props.children}
              </EventsContext.Provider>
            </OrganizationsContext.Provider>
          </RegistrationsContext.Provider>
        </CampersContext.Provider>
      </UserContext.Provider>
    );
  }
}
