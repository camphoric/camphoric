import React from 'react';
import { InputGroup, Button } from 'react-bootstrap';

import { useEvent } from 'hooks/admin';
import Spinner from 'components/Spinner';
import ShowRawJSON from './ShowRawJSON';
import createEventEditForm from './createEventEditForm';

import './Home.scss'

interface Props {
  event: ApiEvent,
}

function EventAdminHome({ event: originalEvent }: Props) {
  const eventContext = useEvent(originalEvent.id);
  const [event, setEvent] = React.useState<ApiEvent>(eventContext.value);

  if (!event) return <Spinner />;

  console.log(event);

  const formItems = createEventEditForm(event);

  const handleChange = (field) => (changeEvent) => setEvent({
    ...event,
    [field]: changeEvent.target.value,
  });

  const save = () => {
    eventContext.set(event);
  };

  return (
    <>
      <h1>Event Information</h1>
      {
        formItems.map(
          ({ label, field, Input, passProps }) => (
            <InputGroup key={field}>
              <InputGroup.Prepend className="home-input-group">
                <InputGroup.Text>{label}</InputGroup.Text>
              </InputGroup.Prepend>
              <Input
                placeholder={label}
                aria-label={label}
                onChange={handleChange(field)}
                {...passProps}
              />
            </InputGroup>
          )
        )
      } 
      <Button variant="primary" onClick={save} className="mt-5">Save</Button>
      <ShowRawJSON json={event} />
    </>
  );
}

export default EventAdminHome;
