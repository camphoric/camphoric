import React from 'react';
import { Button } from 'react-bootstrap';
import { TabProps } from './EventAdminHome';
import Input, { TextArea, KeyValueEdit } from 'components/Input';
import { formatDateForForm } from 'utils/time';
import ShowRawJSON from 'components/ShowRawJSON';


function EventAdminHomeComponent(props: TabProps) {
  const defaultFor = (key: keyof ApiEvent) => 
    props.eventForm[key] || (props.apiEvent && props.apiEvent[key]);

  const defaultTimeFor = (key: keyof ApiEvent) => 
    formatDateForForm(
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
        type="date"
        defaultValue={defaultTimeFor('start')}
      />
      <Input
        label="Event Ends"
        onChange={props.handleFormDateChange('end')}
        type="date"
        defaultValue={defaultTimeFor('end')}
      />
      <Input
        label="Reg Starts"
        onChange={props.handleFormDateChange('registration_start')}
        type="date"
        defaultValue={defaultTimeFor('registration_start')}
      />
      <Input
        label="Reg Ends"
        onChange={props.handleFormDateChange('registration_end')}
        type="date"
        defaultValue={defaultTimeFor('registration_end')}
      />
      <Input
        label="Default Stay"
        onChange={props.handleFormChange('default_stay_length')}
        type="integer"
        defaultValue={defaultFor('default_stay_length')}
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

      <h2>PayPal Data</h2>
      <Input
        label="PayPal Enabled"
        onChange={props.handleFormChange('paypal_enabled')}
        defaultValue={defaultFor('paypal_enabled')}
      />
      <Input
        label="PayPal Key"
        onChange={props.handleFormChange('paypal_client_id')}
        defaultValue={defaultFor('paypal_client_id')}
      />

      <h2>Pricing</h2>
      <KeyValueEdit
        onChange={props.handleChange('pricing')}
        schemaType="integer"
        defaultValue={defaultFor('pricing')}
      />

      <h2>Registration Form Template Values</h2>
      <KeyValueEdit
        onChange={props.handleChange('registration_template_vars')}
        schemaType="string"
        defaultValue={defaultFor('registration_template_vars')}
      />
      
      <Button variant="primary" onClick={props.save} className="mt-5">Save</Button>
      <ShowRawJSON json={props.eventForm} />
    </>

  )
}

export default EventAdminHomeComponent;
