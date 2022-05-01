import React from 'react';
import { Button } from 'react-bootstrap';
import { TabProps } from './EventAdminHome';
import Input, { TextArea, KeyValueEdit } from 'components/Input';
import { formatDateTimeForForm } from 'utils/time';
import ShowRawJSON from 'components/ShowRawJSON';


function EventAdminHomeComponent(props: TabProps) {
  const defaultFor = (key: keyof ApiEvent) => 
    props.eventForm[key] || (props.apiEvent && props.apiEvent[key]);

  const defaultTimeFor = (key: keyof ApiEvent) => 
    formatDateTimeForForm(
      props.eventForm[key] || (props.apiEvent && props.apiEvent[key])
    );


  return (
    <>
      <Input
        label="Name"
        onChange={props.handleFormChange('name')}
        defaultValue={defaultFor('name')}
      />
      <Input
        label="Event Starts"
        onChange={props.handleFormDateChange('start')}
        type="datetime-local"
        defaultValue={defaultTimeFor('start')}
      />
      <Input
        label="Event Ends"
        onChange={props.handleFormDateChange('end')}
        type="datetime-local"
        defaultValue={defaultTimeFor('end')}
      />
      <Input
        label="Reg Starts"
        onChange={props.handleFormDateChange('registration_start')}
        type="datetime-local"
        defaultValue={defaultTimeFor('registration_start')}
      />
      <Input
        label="Reg Ends"
        onChange={props.handleFormDateChange('registration_end')}
        type="datetime-local"
        defaultValue={defaultTimeFor('registration_end')}
      />

      <h2>Confirmation Page</h2>
      <TextArea
        label="Confirmation page message"
        onChange={props.handleFormChange('confirmation_page_template')}
        defaultValue={defaultFor('confirmation_page_template')}
      />

      <h2>Confirmation Email</h2>
      <Input
        label="From"
        onChange={props.handleFormChange('confirmation_email_from')}
        defaultValue={defaultFor('confirmation_email_from')}
      />
      <Input
        label="Subject"
        onChange={props.handleFormChange('confirmation_email_subject')}
        defaultValue={defaultFor('confirmation_email_subject')}
      />
      <TextArea
        label="Confirmation email body"
        onChange={props.handleFormChange('confirmation_email_template')}
        defaultValue={defaultFor('confirmation_email_template')}
      />
      <h2>Pricing</h2>
      <KeyValueEdit
        onChange={props.handleChange('pricing')}
        schemaType="integer"
        defaultValue={defaultFor('pricing')}
      />
      
      <Button variant="primary" onClick={props.save} className="mt-5">Save</Button>
      <ShowRawJSON json={props.eventForm} />
    </>

  )
}

export default EventAdminHomeComponent;
