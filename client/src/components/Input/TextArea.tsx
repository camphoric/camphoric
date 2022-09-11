import React from 'react';
import { Form, FormControl } from 'react-bootstrap';

interface Props extends React.ComponentProps<typeof FormControl> {
  label: string | React.ReactNode;
} 

function TextArea(props: Props) {
  const InputComponent = FormControl;

  const {
    label,
    ...passProps
  } = props;

  return (
    <Form.Group>
      <Form.Label>{label}</Form.Label>
      <InputComponent
        aria-label={label}
        as="textarea"
        {...passProps}
      />
    </Form.Group>
  );
}

export default TextArea;
