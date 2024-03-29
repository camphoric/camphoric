import ReactPhoneInput from 'react-phone-number-input';
import { WidgetProps } from '@rjsf/core';
import 'react-phone-number-input/style.css'
import Form from 'react-bootstrap/Form';
import { getSchemaValue } from '../utils';

export default function PhoneInput (props: WidgetProps) {
  const rawErrors = props.rawErrors || [];
  const className = getSchemaValue(props, 'className');

  return (
    <Form.Group className={`${className || ''} jsonschema-phonenumber mb-0`}>
      <Form.Label className={rawErrors.length > 0 ? 'text-danger' : ''}>
        {props.label}{props.label && props.required ? "*" : null}
      </Form.Label>
      <ReactPhoneInput
        // typdefs are wrong
        // @ts-expect-error
        defaultCountry="US"
        value={props.value}
        onChange={props.onChange}
        className="form-control"
        id={props.id}
      />
    </Form.Group>
  );
}
