import React from 'react';
import { Button } from 'react-bootstrap';
import { TabProps } from './EventAdminHome';
import Input, { TextArea, KeyValueEdit } from 'components/Input';
import { formatDateTimeForForm } from 'utils/time';
import ShowRawJSON from 'components/ShowRawJSON';

function EventAdminHomeComponent(props: TabProps) {
  return (
    <>
      <Input
        label="Name"
        onChange={props.handleFormChange('name')}
        defaultValue={props.event.name}
      />
      <Input
        label="Event Starts"
        onChange={props.handleFormDateChange('start')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(props.event.start)}
      />
      <Input
        label="Event Ends"
        onChange={props.handleFormDateChange('end')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(props.event.end)}
      />
      <Input
        label="Reg Starts"
        onChange={props.handleFormDateChange('registration_start')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(props.event.registration_start)}
      />
      <Input
        label="Reg Ends"
        onChange={props.handleFormDateChange('registration_end')}
        type="datetime-local"
        defaultValue={formatDateTimeForForm(props.event.registration_end)}
      />

      <h2>Confirmation Page</h2>
      <TextArea
        label="Confirmation page message"
        onChange={props.handleFormChange('confirmation_page_template')}
        defaultValue={props.event.confirmation_page_template}
      />

      <h2>Confirmation Email</h2>
      <Input
        label="From"
        onChange={props.handleFormChange('confirmation_email_from')}
        defaultValue={props.event.confirmation_email_from}
      />
      <Input
        label="Subject"
        onChange={props.handleFormChange('confirmation_email_subject')}
        defaultValue={props.event.confirmation_email_subject}
      />
      <TextArea
        label="Confirmation email body"
        onChange={props.handleFormChange('confirmation_email_template')}
        defaultValue={props.event.confirmation_email_template}
      />
      <h2>Pricing</h2>
      <KeyValueEdit
        onChange={props.handleChange('pricing')}
        schemaType="integer"
        defaultValue={props.event.pricing}
      />
      
      <Button variant="primary" onClick={props.save} className="mt-5">Save</Button>
      <ShowRawJSON json={props.event} />
    </>

  )
}

export default EventAdminHomeComponent;
