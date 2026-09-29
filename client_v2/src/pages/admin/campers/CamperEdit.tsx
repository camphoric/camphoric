/**
 * Edit a camper (SPEC §8.5), organized into tabbed sections — Attributes (the
 * schema-driven form), Admin attributes, Fees, History (Registrars and Admins;
 * DR-53), and a raw record for debugging — with a pinned action bar (Save /
 * Delete) always visible below the scrolling section. Save persists the camper's
 * `attributes` and `admin_attributes` in a single PATCH; the camper can be
 * deleted after confirming what that does, and restored later (DR-54, DR-55).
 * The open section is URL-addressable via `?camperTab`.
 *
 * The `camper_schema` is rendered in admin mode (§9.5): the registrant UI schema
 * for a camper is the campers array's item UI schema, admin-transformed; the
 * schema is given the shared `registration_schema.definitions` so `$ref`s (e.g.
 * address) resolve.
 */

import { Box, Button, Group, ScrollArea, Tabs } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiCamper, ApiEvent, Hash } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { JsonSchemaForm } from 'components/form';
import { HistoryPanel } from 'components/History';
import { JsonViewer } from 'components/JsonViewer';
import { CanEdit, usePermissions } from 'hooks/permissions';
import { useSearchTab } from 'hooks/useSearchTab';
import { AdminAttributesForm } from 'pages/admin/AdminAttributesForm';
import { useEffect, useState } from 'react';
import { camperHooks } from 'store/entities';

import { CamperFees } from './CamperFees';
import { useCamperForm } from './camperForm';

interface CamperEditProps {
  event: ApiEvent;
  camper: ApiCamper;
  name: string;
  onDeleted: () => void;
}

export function CamperEdit({ event, camper, name, onDeleted }: CamperEditProps) {
  const update = camperHooks.useUpdate();
  const del = camperHooks.useDelete();
  const [attributes, setAttributes] = useState<Hash>(camper.attributes);
  const [adminAttributes, setAdminAttributes] = useState<Hash>(camper.admin_attributes);
  const { canEdit } = usePermissions();

  useEffect(() => {
    setAttributes(camper.attributes);
    setAdminAttributes(camper.admin_attributes);
  }, [camper]);

  const { schema, uiSchema } = useCamperForm(event);

  const hasAdmin = Object.keys(event.camper_admin_schema ?? {}).length > 0;
  const [tab, setTab] = useSearchTab('camperTab', [
    'attributes',
    ...(hasAdmin ? ['admin'] : []),
    'fees',
    ...(canEdit ? ['history'] : []),
    'raw',
  ]);

  const save = () =>
    update.mutate(
      { id: camper.id, attributes, admin_attributes: adminAttributes },
      { onSuccess: () => notifications.show({ color: 'green', message: 'Camper saved' }) },
    );

  const confirmDeleteCamper = () =>
    confirmDelete({
      path: 'campers',
      id: camper.id,
      title: 'Delete camper',
      message: <>Delete the camper “{name}”?</>,
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
          {canEdit && <Tabs.Tab value="history">History</Tabs.Tab>}
          <Tabs.Tab value="raw">Raw</Tabs.Tab>
        </Tabs.List>
        <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
          <Box py="md">
            <Tabs.Panel value="attributes">
              <JsonSchemaForm
                schema={schema}
                uiSchema={uiSchema}
                formData={attributes}
                templateData={{
                  ...event.registration_template_vars,
                  pricing: event.pricing,
                  formData: camper.attributes,
                }}
                // Validation messages show as the admin edits, but never block
                // saving (admins may need to save partial or legacy data).
                liveValidate
                errorMessages={{
                  rules: event.registration_error_messages,
                  pathPrefix: 'campers.*',
                  camper: { label: name },
                }}
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
            {canEdit && (
              <Tabs.Panel value="history">
                {tab === 'history' && <HistoryPanel event={event} path="campers" id={camper.id} />}
              </Tabs.Panel>
            )}
            <Tabs.Panel value="raw">
              <JsonViewer value={camper} />
            </Tabs.Panel>
          </Box>
        </ScrollArea>
      </Tabs>
      <CanEdit>
        <Group
          justify="space-between"
          pt="sm"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Button onClick={save} loading={update.isPending}>
            Save
          </Button>
          <Button variant="light" color="red" onClick={confirmDeleteCamper} loading={del.isPending}>
            Delete
          </Button>
        </Group>
      </CanEdit>
    </Box>
  );
}
