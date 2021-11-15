import React from 'react';
import { InputGroup, Button } from 'react-bootstrap';

import { useEvent } from 'hooks/admin';
import ShowRawJSON from 'components/ShowRawJSON';
import Spinner from 'components/Spinner';
import createEventEditForm from './createEventEditForm';

interface Props {
  event: ApiEvent,
}

function EventAdminHome({ event: originalEvent }: Props) {
  const [event, setEvent] = React.useState<ApiEvent>(originalEvent);
  const { set: apiPutEvent } = useEvent(originalEvent.id);

  if (!originalEvent) return <Spinner />;

  console.log(event)

  const formItems = createEventEditForm(event);

  const handleChange = (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => setEvent({
    ...event,
    [field]: changeEvent.target.value,
  });

  const save = () => apiPutEvent(event);

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
