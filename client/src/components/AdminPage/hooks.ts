import React from 'react';

export function useAuthToken() {
  const [authToken, setAuthToken] = React.useState(
    localStorage.getItem('AUTH_TOKEN') || ''
  );

  React.useEffect(() => {
    localStorage.setItem('AUTH_TOKEN', authToken);

    const authLocalStorageListener = function(event: StorageEvent) {
      if (event.storageArea !== localStorage) return;
      const newAuthToken = localStorage.getItem('AUTH_TOKEN') || '';
      if (newAuthToken === authToken) return;

      setAuthToken(newAuthToken);
    }

    window.addEventListener('storage', authLocalStorageListener);

    return () => window.removeEventListener('storage', authLocalStorageListener);

  }, [authToken]);

  return { authToken, setAuthToken };
}

export function useEvent(eventId?: string | number) {
  const { authToken } = useAuthToken();
  const [event, setEvent] = React.useState<ApiEvent>();

  React.useEffect(() => {
    const getEvent = async () => {
      try {
        const response = await fetch(
          `/api/events/${eventId}`,
          {
            method: 'GET',
            headers: new Headers({
              'Authorization': `Token ${authToken}`, 
              'Content-Type': 'application/json'
            }),
          },
        );

        const event = await response.json();

        setEvent(event);
      } catch (e) {
      }

    };

    getEvent();
  }, [authToken, eventId]);

  return event;
}

export function useEvents() {
  const { authToken } = useAuthToken();
  const [events, setEvents] = React.useState<ApiEvent[]>([]);

  React.useEffect(() => {
    const getEvents = async () => {
      try {
        const response = await fetch(
          '/api/events/',
          {
            method: 'GET',
            headers: new Headers({
              'Authorization': `Token ${authToken}`, 
              'Content-Type': 'application/json'
            }),
          },
        );

        const events = await response.json();

        setEvents(events);
      } catch (e) {
        // TODO: create some sort of dev level logging
      }

    };

    getEvents();
  }, [authToken]);

  return events;
}

export function useOrganizations() {
  const { authToken } = useAuthToken();
  const [organizations, setOrganizations] = React.useState<ApiOrganization[]>([]);

  React.useEffect(() => {
    const getOrganizations = async () => {
      let organizations
      try {
        const response = await fetch(
          '/api/organizations/',
          {
            method: 'GET',
            headers: new Headers({
              'Authorization': `Token ${authToken}`, 
              'Content-Type': 'application/json'
            }),
          },
        );

        organizations = await response.json();

        setOrganizations(organizations);
      } catch (e) {
        // throw e;
      }
    };

    getOrganizations();
  }, [authToken]);

  return organizations;
}
