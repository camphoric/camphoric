/**
 * KeyValueEdit
 *
 * This component is for editing or inputting simple k/v dictionaries with
 * scalar values.
 */
import React from 'react';
import Form from '@rjsf/core';
import { JSONSchema7 } from 'json-schema';

// We limit values to scalar types
type ValueType = {
  [key: string]: string | number,
};
type JsonSchemaAllowedType = 'string' | 'number' | 'integer';
type JsonSchemaTypes = JsonSchemaAllowedType | JsonSchemaAllowedType[];

interface Props {
  onChange: (val: ValueType) => void;
  defaultValue: ValueType;
  schemaType: JsonSchemaTypes;
};

const keyValueSchema = (schemaType: JsonSchemaTypes):JSONSchema7 => ({
  type: 'object',
  additionalProperties: { type: schemaType },
});

function KeyValueEdit(props: Props) {
  const {
    defaultValue,
    onChange,
    schemaType,
  } = props;

  return (
    <div className="keyvalue-input">
      <Form
        schema={keyValueSchema(schemaType)}
        onChange={({ formData }) => onChange(formData)}
        formData={defaultValue}
      />
    </div>
  );
}

KeyValueEdit.defaultProps = {
  defaultValue: {},
  schemaType: ['string', 'number'],
}

export default KeyValueEdit;
