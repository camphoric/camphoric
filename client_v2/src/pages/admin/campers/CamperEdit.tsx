/**
 * Edit a camper (SPEC §8.5), organized into tabbed sections — Attributes (the
 * schema-driven form), Admin attributes, Fees, and a raw record for debugging —
 * with a pinned action bar (Save / Delete) always visible below the scrolling
 * section. Save persists the camper's `attributes` and `admin_attributes` in a
 * single PATCH; the camper can be deleted (with confirmation).
 *
 * The `camper_schema` is rendered in admin mode (§9.5): the registrant UI schema
 * for a camper is the campers array's item UI schema, admin-transformed; the
 * schema is given the shared `registration_schema.definitions` so `$ref`s (e.g.
 * address) resolve.
 */

import { Box, Button, Group, ScrollArea, Tabs } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { UiSchema } from '@rjsf/utils';
import type { ApiCamper, ApiEvent, Hash } from 'api-types';
import { deriveAdminUiSchema, injectDefinitions, JsonSchemaForm } from 'components/form';
import { JsonViewer } from 'components/JsonViewer';
import { AdminAttributesForm } from 'pages/admin/AdminAttributesForm';
import { useEffect, useMemo, useState } from 'react';
import { camperHooks } from 'store/entities';

import { CamperFees } from './CamperFees';

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
  const del = camperHooks.useDelete();
  const [attributes, setAttributes] = useState<Hash>(camper.attributes);
  const [adminAttributes, setAdminAttributes] = useState<Hash>(camper.admin_attributes);
  const [tab, setTab] = useState<string | null>('attributes');

  useEffect(() => {
    setAttributes(camper.attributes);
    setAdminAttributes(camper.admin_attributes);
  }, [camper]);

  const schema = useMemo(
    () => injectDefinitions(event.camper_schema, event.registration_schema.definitions),
    [event.camper_schema, event.registration_schema],
  );
  const uiSchema = useMemo(
    () => deriveAdminUiSchema(camperItemUiSchema(event.registration_ui_schema)),
    [event.registration_ui_schema],
  );

  const hasAdmin = Object.keys(event.camper_admin_schema ?? {}).length > 0;

  const save = () =>
    update.mutate(
      { id: camper.id, attributes, admin_attributes: adminAttributes },
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
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Tabs
        value={tab}
        onChange={setTab}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <Tabs.List>
          <Tabs.Tab value="attributes">Attributes</Tabs.Tab>
          {hasAdmin && <Tabs.Tab value="admin">Admin attributes</Tabs.Tab>}
          <Tabs.Tab value="fees">Fees</Tabs.Tab>
          <Tabs.Tab value="raw">Raw</Tabs.Tab>
        </Tabs.List>
        <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
          <Box py="md">
            <Tabs.Panel value="attributes">
              <JsonSchemaForm
                schema={schema}
                uiSchema={uiSchema}
                formData={attributes}
                templateData={{ pricing: event.pricing, formData: camper.attributes }}
                onChange={(formData) => setAttributes(formData as Hash)}
              >
                <></>
              </JsonSchemaForm>
            </Tabs.Panel>
            {hasAdmin && (
              <Tabs.Panel value="admin">
                <AdminAttributesForm
                  adminSchema={event.camper_admin_schema}
                  value={adminAttributes}
                  onChange={setAdminAttributes}
                />
              </Tabs.Panel>
            )}
            <Tabs.Panel value="fees">
              <CamperFees event={event} camper={camper} />
            </Tabs.Panel>
            <Tabs.Panel value="raw">
              <JsonViewer value={camper} />
            </Tabs.Panel>
          </Box>
        </ScrollArea>
      </Tabs>
      <Group
        justify="space-between"
        pt="sm"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Button onClick={save} loading={update.isPending}>
          Save
        </Button>
        <Button variant="light" color="red" onClick={confirmDelete} loading={del.isPending}>
          Delete
        </Button>
      </Group>
    </Box>
  );
}
