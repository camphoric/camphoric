import React from 'react';
import { FieldProps } from '@rjsf/core';
import Handlebars from 'handlebars';
import memoize from 'lodash/memoize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { JsonSchemaFormTemplateContext } from '../index';

interface Props extends Partial<FieldProps> {
  description?: string;
}

Handlebars.registerHelper('abs', function(num) {
  const abs = Math.abs(num);

  if (!abs) return num;

  return abs;
});

// compile once please!
const compileTemplate = memoize(Handlebars.compile);

function DescriptionField(props: Props) {
  const templateVars =  React.useContext(JsonSchemaFormTemplateContext);
  const md = compileTemplate(props.description || "")(templateVars);

  return (
    <div
      id={props.id}
      className="field-description"
    >
      <ReactMarkdown children={md || ''} remarkPlugins={[remarkGfm]} />
    </div>
  );
}

export default DescriptionField;
