import React, { ChangeEvent } from 'react';

interface ControllableInput {
  value: string,
  onChange: (a: string) => void,
}

class NaturalNumberInput extends React.Component<ControllableInput> {
  // generalize this component. i know you want to.
  static regex = /[0-9]*/;

  onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitizedRegex =
      (e.currentTarget.value || '').match(NaturalNumberInput.regex);
    const sanitized = sanitizedRegex
      ? sanitizedRegex[0]
      : '';

    this.props.onChange(sanitized);
  }

  render(){
    return <input
      type="number" 
      className="form-control"
      step={0}
      value={this.props.value || ''}
      onChange={this.onChange} />
  }
}

export default NaturalNumberInput;