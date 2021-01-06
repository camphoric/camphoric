import ReactPhoneInput from 'react-phone-input-2';
import { WidgetProps } from '@rjsf/core';
import 'react-phone-input-2/lib/style.css'
import Form from 'react-bootstrap/Form';

export default function PhoneInput (props: WidgetProps) {
  const rawErrors = props.rawErrors || [];

  return (
    <Form.Group className={`${props.uiSchema.className || ''} jsonschema-phonenumber mb-0`}>
      <Form.Label className={rawErrors.length > 0 ? 'text-danger' : ''}>
        {props.label}{props.label && props.required ? "*" : null}
      </Form.Label>
      <ReactPhoneInput
        country="us"
        value={props.value}
        onChange={props.onChange}
      />
    </Form.Group>
  );
}
