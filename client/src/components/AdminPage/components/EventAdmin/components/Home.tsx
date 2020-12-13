import React from 'react';
import {
  Button,
  Collapse,
  InputGroup,
} from 'react-bootstrap';

import createEventEditForm from './createEventEditForm';

interface Props {
  event: ApiEvent,
}

function EventAdminHome({ event }: Props) {
  const [showRawJson, setShowRawJson] = React.useState(false);
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
                defaultValue={event[field]}
                {...passProps}
              />
            </InputGroup>
          )
        )
      } 
      <div className="event-admin-show-raw">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => setShowRawJson(!showRawJson)}
          aria-expanded={showRawJson}
        >
          Show Raw JSON
        </Button>
        <Collapse in={showRawJson}>
          <pre className="event-admin-raw-json">{JSON.stringify(event, null, 2)}</pre>
        </Collapse>
      </div>
    </>
  );
}

export default EventAdminHome;
