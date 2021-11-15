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

type ApiResource = 'events' | 'organizations' | 'registrations' | 'campers';

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

  getCsrfToken = () => {
    const match = document.cookie.match(/\bcsrftoken=([^;]+)/);

    return (match && match[1]) || '';
  }

  async apiFetch<P extends MinimumApiObject>(resource: ApiResource): Promise<P[]> {
    let value = [];

    try {
      const response = await fetch(
        `/api/${resource}/`,
        {
          method: 'GET',
          credentials: 'include',
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken(),
          }),
        },
      );

      if (response.status === 401) this.setUser(unauthenticatedUser);

      value = await response.json();
    } catch (e) {
      console.error(`error getting ${resource}`, e);
    }

    return value;
  }

  async apiPut<P extends MinimumApiObject>(resource: ApiResource, value: P): Promise<void> {
    try {
      const response = await fetch(
        `/api/${resource}/${value.id}/`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: new Headers({
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken(),
          }),
          body: JSON.stringify(value),
        },
      );

      if (response.status === 401) this.setUser(unauthenticatedUser);

    } catch (e) {
      console.error(`error getting ${resource}`, e);
    }
  }

  getFactory<P extends MinimumApiObject>(resource: ApiResource) {
    return () => this.setState((prevState: State) => ({
      ...prevState,
      [resource]: {
        ...prevState[resource],
        status: 'fetching',
      }
    }), async () => {
      const value = await this.apiFetch<P>(resource);

      this.setState((prevState: State) => ({
        ...prevState,
        [resource]: {
          get: this.getFactory(resource),
          set: this.setFactory(resource),
          value,
          status: 'done',
        },
      }));
    });
  }

  setFactory<P extends MinimumApiObject>(resource: ApiResource) {
    return (newValue: P) => this.setState((prevState: State) => ({
      ...prevState,
      [resource]: {
        ...prevState[resource],
        status: 'setting',
      }
    }), async () => {
      await this.apiPut<P>(resource, newValue);
      await this.state[resource].get();
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
