import React, { ChangeEvent } from 'react';
import Form from "react-bootstrap/Form";
import { WidgetProps } from "@rjsf/core";

import { getSchemaValue } from '../utils';

export interface Props extends WidgetProps {
  value: string;
  onChange: (a: string) => void;
}

const numbersOnly = /[0-9]*/;

function NaturalNumberInput(props: Props) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitizedRegex = (e.currentTarget.value || '').match(numbersOnly);
    const sanitized = sanitizedRegex
      ? sanitizedRegex[0]
      : '';

    props.onChange(sanitized);
  }

  const title = props.label || getSchemaValue(props, 'title');
  const rawErrors = props.rawErrors || [];

  return (
    <Form.Group className="natural-number-input mb-0 col-auto">
      <Form.Label className={rawErrors.length > 0 ? 'text-danger' : ''}>
        {title}
        {!!title && props.required ? '*' : null}
      </Form.Label>
      <input
        id={props.id}
        type="number" 
        className="form-control"
        step={0}
        value={props.value}
        onChange={onChange}
      />
    </Form.Group>
  );
}

export default NaturalNumberInput;
