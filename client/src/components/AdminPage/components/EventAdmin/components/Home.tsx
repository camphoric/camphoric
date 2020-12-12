import React from 'react';
import { InputGroup, FormControl } from 'react-bootstrap';

interface Props {
  event: ApiEvent,
}

function EventAdminHome({ event }: Props) {
  const formItems = [
    ['Name', 'name', FormControl, { defaultValue: event.name }],
    ['Reg Start', 'registration_start', FormControl, { defaultValue: event.name }],
  ];

  return (
    <div>
      <h1>Event Information</h1>
      {
        formItems.map(
          ([label, key, Input, passProps]) => (
            <InputGroup>
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
      <pre>{JSON.stringify(event, null, 2)}</pre>
    </div>
  );
}

export default EventAdminHome;
