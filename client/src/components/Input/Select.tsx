import React from 'react';
import { Form, FormControl } from 'react-bootstrap';

interface Props extends React.ComponentProps<typeof FormControl> {
  label: string;
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
    ...passProps
  } = props;

  return (
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
