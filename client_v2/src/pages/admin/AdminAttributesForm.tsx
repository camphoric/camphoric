/**
 * Admin-only attributes editor (SPEC §8.4, §8.5). Renders the combined
 * `*_admin_schema` map as a single form. Shared by the registration and camper
 * editors; a controlled input — the parent owns the value and persists it (as
 * part of the record's unified Save via PATCH `admin_attributes`).
 *
 * Renders nothing when the event defines no admin schema.
 */

import type { Hash } from 'api-types';
import { combineAdminSchema, JsonSchemaForm } from 'components/form';
import { useMemo } from 'react';

interface AdminAttributesFormProps {
  /** The `*_admin_schema` map: `{ key: { data, ui } }`. */
  adminSchema: Hash;
  /** The record's current `admin_attributes`. */
  value: Hash;
  onChange: (adminAttributes: Hash) => void;
}

export function AdminAttributesForm({ adminSchema, value, onChange }: AdminAttributesFormProps) {
  const { schema, uiSchema } = useMemo(() => combineAdminSchema(adminSchema), [adminSchema]);

  if (Object.keys(adminSchema).length === 0) return null;

  return (
    <JsonSchemaForm
      schema={schema}
      uiSchema={uiSchema}
      formData={value}
      onChange={(next) => onChange(next as Hash)}
    >
      <></>
    </JsonSchemaForm>
  );
}
