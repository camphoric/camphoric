import React from 'react';
import { InputGroup } from 'react-bootstrap';
import { useParams } from 'react-router-dom';

import { useEvent } from 'hooks/admin';
import Spinner from 'components/Spinner';
import ShowRawJSON from './ShowRawJSON';
import createEventEditForm from './createEventEditForm';

function EventAdminHome() {
  const { eventId } = useParams<RouterUrlParams>();
  const { value: event } = useEvent(eventId);

  if (!event) return <Spinner />;

  const formItems = createEventEditForm(event);

  return (
    <>
      <h1>Event Information</h1>
      {
        formItems.map(
          ({ label, field, Input, passProps }) => (
            <InputGroup key={field}>
              <InputGroup.Prepend>
                <InputGroup.Text>{label}</InputGroup.Text>
              </InputGroup.Prepend>
              <Input
                placeholder={label}
                aria-label={label}
                {...passProps}
              />
            </InputGroup>
          )
        )
      } 
      <ShowRawJSON json={event} />
    </>
  );
}

export default EventAdminHome;
