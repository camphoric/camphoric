import React from 'react';

import { useEvent } from 'hooks/admin';
import Spinner from 'components/Spinner';
import { formatDateTimeForApi } from 'utils/time';

import EventAdminHomeComponent from './EventAdminHomeComponent';

export interface TabProps {
  handleFormChange: (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => any;
  handleFormDateChange: (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => any;
  handleChange: (field: string) => (value: any) => any;
  event: ApiEvent;
  save: () => any;
}

function EventAdminHome({ event: originalEvent }: EventAdminPageProps) {
  const [event, setEvent] = React.useState<ApiEvent>(originalEvent);
  const { set: apiPutEvent } = useEvent(originalEvent.id);

  if (!originalEvent) return <Spinner />;

  // console.log(event);

  const handleFormChange = (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => setEvent({
    ...event,
    [field]: changeEvent.target.value,
  });

  const handleFormDateChange = (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;
    const dateValue = formatDateTimeForApi(value);

    // console.log(dateValue);

    setEvent({
      ...event,
      [field]: dateValue,
    });
  }

  const handleChange = (field: string) => (value: any) => setEvent({
    ...event,
    [field]: value,
  });

  const save = () => apiPutEvent(event);

  const tabProps: TabProps = {
    handleFormChange,
    handleFormDateChange,
    handleChange,
    event,
    save,
  };

  return (
    <EventAdminHomeComponent {...tabProps} />
  );
}

export default EventAdminHome;
