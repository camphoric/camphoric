import React from 'react';

import api, { useEvent } from 'hooks/api';

import Spinner from 'components/Spinner';
import { formatDateTimeForApi } from 'utils/time';

import EventAdminHomeComponent from './EventAdminHomeComponent';

export interface TabProps {
  handleFormChange: (field: keyof ApiEvent) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => any;
  handleFormDateChange: (field: keyof ApiEvent) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => any;
  handleChange: (field: keyof ApiEvent) => (value: any) => any;
  eventForm: Partial<ApiEvent>;
  apiEvent: ApiEvent | undefined;
  save: () => any;
}

function EventAdminHome() {
  const [eventForm, setEvent] = React.useState<Partial<ApiEvent>>({});
  const eventApi = useEvent();
  const [updateEvent] = api.useUpdateEventMutation();

  if (eventApi.isLoading || !eventApi.data) return <Spinner />;

  const handleFormChange = (field: keyof ApiEvent) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => setEvent({
    ...eventForm,
    [field]: changeEvent.target.value,
  });

  const handleFormDateChange = (field: keyof ApiEvent) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;
    const dateValue = formatDateTimeForApi(value);

    // console.log(dateValue);

    setEvent({
      ...eventForm,
      [field]: dateValue,
    });
  }

  const handleChange = (field: keyof ApiEvent) => (value: any) => setEvent({
    ...eventForm,
    [field]: value,
  });

  const save = () => updateEvent({
    ...eventForm,
    id: eventApi.data?.id || 0,
  });

  const tabProps: TabProps = {
    handleFormChange,
    handleFormDateChange,
    handleChange,
    eventForm,
    apiEvent: eventApi.data,
    save,
  };

  return (
    <EventAdminHomeComponent {...tabProps} />
  );
}

export default EventAdminHome;
