import React from 'react';
import { FormControl, InputGroup } from 'react-bootstrap';

interface Props extends React.ComponentProps<typeof FormControl> {
  label: string;
} 

function BasicInput(props: Props) {
  const InputComponent = FormControl;

  const {
    label,
    ...passProps
  } = props;

  return (
    <InputGroup>
      <InputGroup.Prepend className="home-input-group">
        <InputGroup.Text>{label}</InputGroup.Text>
      </InputGroup.Prepend>
      <InputComponent
        aria-label={label}
        {...passProps}
      />
    </InputGroup>
  );
}

export default BasicInput;
