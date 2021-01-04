import React from 'react';
import { FieldProps } from '@rjsf/core';
import Markdown from '../../Markdown';

interface Props extends Partial<FieldProps> {
  description?: string;
}

function DescriptionField({ id, description }: Props) {
  return (
    <div
      id={id}
      className="field-description"
    >
      <Markdown
        markdown={description || ''}
      />
    </div>
  );
}

export default DescriptionField;
