/**
 * Edit a camper's schema-driven attributes (SPEC §8.5). The `camper_schema` is
 * rendered in admin mode (§9.5): the registrant UI schema for a camper is the
 * campers array's item UI schema, admin-transformed; the schema is given the
 * shared `registration_schema.definitions` so `$ref`s (e.g. address) resolve.
 * Persists via PATCH `attributes`; the camper can be deleted (with confirmation).
 * The raw record is exposed as a debugging aid.
 *
 * Admin-only attributes, lodging stay, and custom charges are later slices.
 */

import { Button, Group, Stack, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { UiSchema } from '@rjsf/utils';
import type { ApiCamper, ApiEvent, Hash } from 'api-types';
import { deriveAdminUiSchema, injectDefinitions, JsonSchemaForm } from 'components/form';
import { JsonViewer } from 'components/JsonViewer';
import { AdminAttributesForm } from 'pages/admin/AdminAttributesForm';
import { useEffect, useMemo, useState } from 'react';
import { camperHooks } from 'store/entities';

interface CamperEditProps {
  event: ApiEvent;
  camper: ApiCamper;
  name: string;
  onDeleted: () => void;
}

/** The camper UI schema is the campers array's item UI schema (§9.1, §9.5). */
function camperItemUiSchema(registrationUiSchema: Hash): UiSchema {
  const campers = registrationUiSchema.campers;
  const items =
    campers && typeof campers === 'object' ? (campers as Hash).items : undefined;
  return (items && typeof items === 'object' ? items : {}) as UiSchema;
}

export function CamperEdit({ event, camper, name, onDeleted }: CamperEditProps) {
  const update = camperHooks.useUpdate();
  const adminUpdate = camperHooks.useUpdate();
  const del = camperHooks.useDelete();
  const [attributes, setAttributes] = useState<Hash>(camper.attributes);

  useEffect(() => {
    setAttributes(camper.attributes);
  }, [camper]);

  const schema = useMemo(
    () => injectDefinitions(event.camper_schema, event.registration_schema.definitions),
    [event.camper_schema, event.registration_schema],
  );
  const uiSchema = useMemo(
    () => deriveAdminUiSchema(camperItemUiSchema(event.registration_ui_schema)),
    [event.registration_ui_schema],
  );

  const save = () =>
    update.mutate(
      { id: camper.id, attributes },
      { onSuccess: () => notifications.show({ color: 'green', message: 'Camper saved' }) },
    );

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Delete camper',
      children: <span>Delete the camper “{name}”?</span>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: camper.id }, { onSuccess: onDeleted }),
    });

  return (
    <Stack>
      <Title order={3}>{name || 'Camper'}</Title>
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={attributes}
        templateData={{ pricing: event.pricing, formData: camper.attributes }}
        onChange={(formData) => setAttributes(formData as Hash)}
      >
        <></>
      </JsonSchemaForm>
      <Group>
        <Button onClick={save} loading={update.isPending}>
          Save
        </Button>
        <Button variant="light" color="red" onClick={confirmDelete} loading={del.isPending}>
          Delete
        </Button>
      </Group>
      <AdminAttributesForm
        key={`camper-admin-${camper.id}`}
        adminSchema={event.camper_admin_schema}
        value={camper.admin_attributes}
        onSave={(admin_attributes) =>
          adminUpdate.mutate(
            { id: camper.id, admin_attributes },
            { onSuccess: () => notifications.show({ color: 'green', message: 'Admin attributes saved' }) },
          )
        }
        saving={adminUpdate.isPending}
      />
      <JsonViewer value={camper} />
    </Stack>
  );
}
