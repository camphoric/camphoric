import React from 'react';

import { Button } from 'react-bootstrap';
import Input, { TextArea, KeyValueEdit } from 'components/Input';
import { useEvent } from 'hooks/admin';
import ShowRawJSON from 'components/ShowRawJSON';
import Spinner from 'components/Spinner';
import { formatDateTimeForForm, formatDateTimeForApi } from 'utils/time';

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

  return (
    <>
      <h1>Event Information</h1>

      <h2>Basic</h2>
      <Input
        label="Name"
        onChange={handleFormChange('name')}
        defaultValue={event.name}
      />
      <Input
        label="Event Starts"
        onChange={handleFormDateChange('start')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(event.start)}
      />
      <Input
        label="Event Ends"
        onChange={handleFormDateChange('end')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(event.end)}
      />
      <Input
        label="Reg Starts"
        onChange={handleFormDateChange('registration_start')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(event.registration_start)}
      />
      <Input
        label="Reg Ends"
        onChange={handleFormDateChange('registration_end')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(event.registration_end)}
      />

      <h2>Confirmation Page</h2>
      <TextArea
        label="Confirmation page message"
        onChange={handleFormChange('confirmation_page_template')}
        defaultValue={event.confirmation_page_template}
      />

      <h2>Confirmation Email</h2>
      <Input
        label="From"
        onChange={handleFormChange('confirmation_email_from')}
        defaultValue={event.confirmation_email_from}
      />
      <Input
        label="Subject"
        onChange={handleFormChange('confirmation_email_subject')}
        defaultValue={event.confirmation_email_subject}
      />
      <TextArea
        label="Confirmation email body"
        onChange={handleFormChange('confirmation_email_template')}
        defaultValue={event.confirmation_email_template}
      />
      <h2>Pricing</h2>
      <KeyValueEdit
        onChange={handleChange('pricing')}
        schemaType="integer"
        defaultValue={event.pricing}
      />
      
      <Button variant="primary" onClick={save} className="mt-5">Save</Button>
      <ShowRawJSON json={event} />
    </>
  );
}

export default EventAdminHome;
