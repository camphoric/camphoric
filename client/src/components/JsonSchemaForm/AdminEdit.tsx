import React from 'react';
import JsonSchemaForm, { Props } from './JsonSchemaForm';

function AdminEdit(props: Props) {
  return (
    <div className="admin-edit">
      <JsonSchemaForm
        {...props}
        schema={{
          ...props.schema,
          title: '',
        }}
      >
        &nbsp;
      </JsonSchemaForm>
    </div>
  );
}

export default AdminEdit;
export type { Props, JsonSchemaFormChangeEvent, FormData } from './JsonSchemaForm';
