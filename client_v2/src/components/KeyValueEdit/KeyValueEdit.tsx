/**
 * Editor for a freely editable set of key/value pairs with scalar values
 * (SPEC §9.6) — e.g. the event's `pricing` and `registration_template_vars`.
 * Reuses the form engine's `additionalProperties` editing (add/remove rows).
 */

import type { RJSFSchema } from '@rjsf/utils';
import { JsonSchemaForm } from 'components/form';

export type ScalarValueType = 'string' | 'integer' | 'number';
export type KeyValueMap = Record<string, string | number>;

interface KeyValueEditProps {
  value?: KeyValueMap;
  valueType?: ScalarValueType;
  onChange: (value: KeyValueMap) => void;
}

export function KeyValueEdit({ value, valueType = 'string', onChange }: KeyValueEditProps) {
  const schema: RJSFSchema = { type: 'object', additionalProperties: { type: valueType } };
  return (
    <JsonSchemaForm
      schema={schema}
      formData={value ?? {}}
      onChange={(formData) => onChange((formData ?? {}) as KeyValueMap)}
    >
      <></>
    </JsonSchemaForm>
  );
}
