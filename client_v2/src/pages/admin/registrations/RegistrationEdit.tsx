/**
 * Edit a registration (SPEC §8.4), organized into tabbed sections — Attributes
 * (registration type, registrant email, and the schema-driven form), Admin
 * attributes, Fees & payments, Campers, and a raw record for debugging — with a
 * pinned action bar (Save / Delete) always visible below the scrolling section.
 * Save persists `{ registrant_email, registration_type, attributes,
 * admin_attributes }` in a single PATCH; the registration can be deleted (with
 * confirmation). The attributes form is rendered in admin mode (§9.5).
 */

import { Box, Button, Group, ScrollArea, Select, Stack, Tabs, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiEvent, AugmentedRegistration, Hash, RegistrationTypeLookup } from 'api-types';
import { deriveAdminUiSchema, JsonSchemaForm } from 'components/form';
import { JsonViewer } from 'components/JsonViewer';
import { AdminAttributesForm } from 'pages/admin/AdminAttributesForm';
import { useEffect, useMemo, useState } from 'react';
import { registrationHooks } from 'store/entities';

import { RegistrationCampers } from './RegistrationCampers';
import { RegistrationPayments } from './RegistrationPayments';

const NONE = 'none';

interface RegistrationEditProps {
  event: ApiEvent;
  registration: AugmentedRegistration;
  registrationTypes: RegistrationTypeLookup;
  onDeleted: () => void;
}

export function RegistrationEdit({
  event,
  registration,
  registrationTypes,
  onDeleted,
}: RegistrationEditProps) {
  const update = registrationHooks.useUpdate();
  const del = registrationHooks.useDelete();

  const [email, setEmail] = useState(registration.registrant_email);
  const [regType, setRegType] = useState<string>(
    registration.registration_type == null ? NONE : String(registration.registration_type),
  );
  const [attributes, setAttributes] = useState<Hash>(registration.attributes);
  const [adminAttributes, setAdminAttributes] = useState<Hash>(registration.admin_attributes);
  const [tab, setTab] = useState<string | null>('attributes');

  // Reset the controlled fields when a different registration is selected.
  useEffect(() => {
    setEmail(registration.registrant_email);
    setRegType(
      registration.registration_type == null ? NONE : String(registration.registration_type),
    );
    setAttributes(registration.attributes);
    setAdminAttributes(registration.admin_attributes);
  }, [registration]);

  const adminUiSchema = useMemo(
    () => deriveAdminUiSchema(event.registration_ui_schema),
    [event.registration_ui_schema],
  );

  const hasAdmin = Object.keys(event.registration_admin_schema ?? {}).length > 0;

  const typeOptions = [
    { value: NONE, label: 'None' },
    ...Object.values(registrationTypes).map((rt) => ({ value: String(rt.id), label: rt.label })),
  ];

  const save = () =>
    update.mutate(
      {
        id: registration.id,
        registrant_email: email,
        registration_type: regType === NONE ? null : Number(regType),
        attributes,
        admin_attributes: adminAttributes,
      },
      { onSuccess: () => notifications.show({ color: 'green', message: 'Registration saved' }) },
    );

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Delete registration',
      children: <span>Delete the registration for “{registration.registrant_email}”?</span>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: registration.id }, { onSuccess: onDeleted }),
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
          <Tabs.Tab value="fees">Fees &amp; payments</Tabs.Tab>
          <Tabs.Tab value="campers">Campers</Tabs.Tab>
          <Tabs.Tab value="raw">Raw</Tabs.Tab>
        </Tabs.List>
        <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
          <Box py="md">
            <Tabs.Panel value="attributes">
              <Stack>
                <Select
                  label="Registration type"
                  data={typeOptions}
                  value={regType}
                  onChange={(value) => setRegType(value ?? NONE)}
                  allowDeselect={false}
                  maw={320}
                />
                <TextInput
                  label="Registrant email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  maw={320}
                />
                <JsonSchemaForm
                  schema={event.registration_schema}
                  uiSchema={adminUiSchema}
                  formData={attributes}
                  templateData={{
                    pricing: event.pricing,
                    formData: registration.attributes,
                    totals: registration.server_pricing_results,
                  }}
                  onChange={(formData) => setAttributes(formData as Hash)}
                >
                  <></>
                </JsonSchemaForm>
              </Stack>
            </Tabs.Panel>
            {hasAdmin && (
              <Tabs.Panel value="admin">
                <AdminAttributesForm
                  adminSchema={event.registration_admin_schema}
                  value={adminAttributes}
                  onChange={setAdminAttributes}
                />
              </Tabs.Panel>
            )}
            <Tabs.Panel value="fees">
              <RegistrationPayments event={event} registration={registration} />
            </Tabs.Panel>
            <Tabs.Panel value="campers">
              <RegistrationCampers registration={registration} />
            </Tabs.Panel>
            <Tabs.Panel value="raw">
              <JsonViewer value={registration} />
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
