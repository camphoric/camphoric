import React from 'react';
import { Form, FormControl, InputGroup } from 'react-bootstrap';

interface Props extends React.ComponentProps<typeof FormControl> {
  label: string;
  inline?: boolean;
  options: Array<{
    label: string;
    value: string | number;
  }>;
} 

function Select(props: Props) {
  const InputComponent = Form.Control;

  const {
    label,
    options,
    inline,
    ...passProps
  } = props;

  return inline ? (
    <InputGroup>
      <InputGroup.Prepend className="home-input-group">
        <InputGroup.Text>{label}</InputGroup.Text>
      </InputGroup.Prepend>
      <InputComponent
        aria-label={label}
        as="select"
        {...passProps}
      >
        {
          options.map((o) => (
            <option key={o.value} value={o.value}>{ o.label }</option>
          ))
        }
      </InputComponent>
    </InputGroup>
  ) : (
    <Form.Group>
      <Form.Label>{label}</Form.Label>
      <InputComponent
        aria-label={label}
        as="select"
        {...passProps}
      >
      {
        options.map((o) => (
          <option key={o.value} value={o.value}>{ o.label }</option>
        ))
      }
      </InputComponent>
    </Form.Group>
  );
}

export default Select;
