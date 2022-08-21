import React from 'react';
import { FormControl, InputGroup } from 'react-bootstrap';

interface Props extends React.ComponentProps<typeof FormControl> {
  label: string;
} 

function Money(props: Props) {
  const InputComponent = FormControl;

  const {
    label,
    ...passProps
  } = props;

  return (
    <InputGroup>
      <InputGroup.Prepend className="home-input-group">
        <InputGroup.Text>{label}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$</InputGroup.Text>
      </InputGroup.Prepend>
      <InputComponent
        aria-label={label}
        type="number"
        step="0.01"
        min="0"
        {...passProps}
      />
    </InputGroup>
  );
}

export default Money;
