/**
 * Textarea with hard maxLength truncation (SPEC §9.1). The @rjsf/mantine base
 * Textarea doesn't enforce a maximum, so this clamps input to the schema's
 * `maxLength` — guarding against pasted or pre-filled values that overflow.
 */

import { Textarea } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';
import type { ChangeEvent } from 'react';

import { widgetCommon } from './widgetProps';

export function TextareaWidget(props: WidgetProps) {
  const { id, label, required, placeholder, disabled, error, value, options } =
    widgetCommon<string>(props);
  const { onChange, onBlur, onFocus, schema } = props;
  const maxLength = typeof schema.maxLength === 'number' ? schema.maxLength : undefined;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    let next = event.currentTarget.value;
    if (maxLength !== undefined && next.length > maxLength) {
      next = next.slice(0, maxLength);
    }
    onChange(next === '' ? options.emptyValue : next);
  };

  return (
    <Textarea
      id={id}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      error={error}
      minRows={options.rows ?? 5}
      autosize
      maxLength={maxLength}
      value={typeof value === 'string' ? value : ''}
      onChange={handleChange}
      onBlur={(event) => onBlur(id, event.currentTarget.value)}
      onFocus={(event) => onFocus(id, event.currentTarget.value)}
    />
  );
}
