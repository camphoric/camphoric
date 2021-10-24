import React from 'react';
import {
  UserContext,
  OrganizationsContext,
  EventsContext,
  RegistrationsContext,
  CampersContext,
  ContextValue,
  UserInfo,
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

  setUser = (value: UserInfo) => {
    const user = {
      set: this.setUser,
      value,
    };

    this.setState({ user });
  }

  async apiFetch<P>(endpoint: ApiEndpoint): Promise<P[]> {
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
