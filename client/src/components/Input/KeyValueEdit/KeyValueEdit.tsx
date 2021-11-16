import React from 'react';
import Form from '@rjsf/core';

type ValueType = Object;

interface Props {
  onChange: (val: ValueType) => void;
  defaultValue: ValueType;
};

const keyValueSchema = {
  'type': 'object',
  'additionalProperties': true,
};

function KeyValueEdit(props: Props) {
  const {
    defaultValue,
    onChange,
  } = props;

  return (
    <div className="keyvalue-input">
      <Form
        schema={keyValueSchema}
        onChange={({ formData }) => onChange(formData)}
        formData={defaultValue}
      />
    </div>
  );
}

export default KeyValueEdit;
