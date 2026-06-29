/**
 * Textarea with hard maxLength truncation (SPEC §9.1). The @rjsf/mantine base
 * Textarea doesn't enforce a maximum, so this clamps input to the schema's
 * `maxLength` — guarding against pasted or pre-filled values that overflow.
 */

import { Textarea } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';
import type { ChangeEvent } from 'react';

interface TextareaOptions {
  rows?: number;
  emptyValue?: unknown;
}

export function TextareaWidget(props: WidgetProps) {
  const { id, onChange, onBlur, onFocus, label, required, disabled, readonly, placeholder, schema } =
    props;
  const value = props.value as string | undefined;
  const options = props.options as TextareaOptions;
  const error = props.rawErrors && props.rawErrors.length > 0 ? props.rawErrors.join('\n') : undefined;
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
      label={label || undefined}
      required={required}
      disabled={disabled || readonly}
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
