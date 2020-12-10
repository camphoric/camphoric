import React from 'react';

export const AuthContext = React.createContext({
  set: (value: string) => {},
  value: '',
});

export const EventsContext = React.createContext({
  poll: async () => Promise.resolve(),
  value: [] as Array<ApiEvent>,
});

export const OrganizationsContext = React.createContext({
  poll: async () => Promise.resolve(),
  value: [] as Array<ApiOrganization>,
});

export function useAuthToken() {
  const authToken = React.useContext(AuthContext);

  return authToken;
}

export function useEvents() {
  const events = React.useContext(EventsContext);

  if (!events.value || !events.value.length) events.poll();

  return events;
}

export function useEvent(eventId?: string | number) {
  const events = React.useContext(EventsContext);

  if (!events.value || !events.value.length) events.poll();

  const eventIdStr = eventId && eventId.toString();

  return {
    poll: events.poll,
    value: events.value.find(e => e.id.toString() === eventIdStr),
  };
}

export function useOrganizations() {
  const organizations = React.useContext(OrganizationsContext);

  if (!organizations.value || !organizations.value.length) organizations.poll();

  return organizations;
}
