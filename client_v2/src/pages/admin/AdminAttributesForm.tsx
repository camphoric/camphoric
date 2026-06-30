/**
 * Admin-only attributes editor (SPEC §8.4, §8.5). Renders the combined
 * `*_admin_schema` map as a single form and persists it via PATCH
 * `admin_attributes`. Shared by the registration and camper editors.
 *
 * The caller passes `key={…id}` so the local form state re-initializes when a
 * different record is selected.
 */

import { Button, Group, Stack, Title } from '@mantine/core';
import type { Hash } from 'api-types';
import { combineAdminSchema, JsonSchemaForm } from 'components/form';
import { useMemo, useState } from 'react';

interface AdminAttributesFormProps {
  /** The `*_admin_schema` map: `{ key: { data, ui } }`. */
  adminSchema: Hash;
  /** The record's current `admin_attributes`. */
  value: Hash;
  onSave: (adminAttributes: Hash) => void;
  saving: boolean;
  title?: string;
}

export function AdminAttributesForm({
  adminSchema,
  value,
  onSave,
  saving,
  title = 'Admin attributes',
}: AdminAttributesFormProps) {
  const [formData, setFormData] = useState<Hash>(value);
  const { schema, uiSchema } = useMemo(() => combineAdminSchema(adminSchema), [adminSchema]);

  if (Object.keys(adminSchema).length === 0) return null;

  return (
    <Stack>
      <Title order={4}>{title}</Title>
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={(next) => setFormData(next as Hash)}
      >
        <></>
      </JsonSchemaForm>
      <Group>
        <Button onClick={() => onSave(formData)} loading={saving}>
          Save admin attributes
        </Button>
      </Group>
    </Stack>
  );
}
