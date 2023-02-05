import React from 'react';
import { FieldProps } from '@rjsf/core';
import Template from 'components/Template';
import { JsonSchemaFormTemplateContext } from '../index';

interface Props extends Partial<FieldProps> {
  description?: string;
}

function DescriptionField(props: Props) {
  const templateVars =  React.useContext(JsonSchemaFormTemplateContext);
  let description = props.description;

  if (!description || typeof description !== 'string') {
    description = '';
  }

  return (
    <div
      id={props.id}
      className="field-description"
    >
      <Template markdown={description} templateVars={templateVars} />
    </div>
  );
}

export default DescriptionField;
