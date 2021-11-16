import React from 'react';

import { Button } from 'react-bootstrap';
import Input, { TextArea, KeyValueEdit } from 'components/Input';
import { useEvent } from 'hooks/admin';
import ShowRawJSON from 'components/ShowRawJSON';
import Spinner from 'components/Spinner';

interface Props {
  event: ApiEvent,
}

function EventAdminHome({ event: originalEvent }: Props) {
  const [event, setEvent] = React.useState<ApiEvent>(originalEvent);
  const { set: apiPutEvent } = useEvent(originalEvent.id);

  if (!originalEvent) return <Spinner />;

  // console.log(event);

  const handleFormChange = (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => setEvent({
    ...event,
    [field]: changeEvent.target.value,
  });

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
        onChange={handleFormChange('start')}
        type="date"
        defaultValue={formatDate(event.start)}
      />
      <Input
        label="Event Ends"
        onChange={handleFormChange('end')}
        type="date"
        defaultValue={formatDate(event.end)}
      />
      <Input
        label="Reg Starts"
        onChange={handleFormChange('registration_start')}
        type="date"
        defaultValue={formatDate(event.registration_start)}
      />
      <Input
        label="Reg Ends"
        onChange={handleFormChange('registration_end')}
        type="date"
        defaultValue={formatDate(event.registration_end)}
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

function formatDate(dateStr: string | null) {
  const date = new Date(dateStr || '');

  if (!date) return undefined;

  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return [year, month, day].join('-');
}

export default EventAdminHome;
