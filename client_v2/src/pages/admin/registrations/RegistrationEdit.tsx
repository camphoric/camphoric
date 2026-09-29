/**
 * Edit a registration (SPEC §8.4), organized into tabbed sections — Attributes
 * (registration type, registrant email, and the schema-driven form), Admin
 * attributes, Fees & payments, Campers, History (Registrars and Admins; its
 * changes and its campers', payments' and charges', DR-53), and a raw record for
 * debugging — with a pinned action bar (Save / Delete) always visible below the
 * scrolling section. Save persists `{ registrant_email, registration_type,
 * attributes, admin_attributes }` in a single PATCH; the registration can be
 * deleted after confirming what that does, and restored later (DR-54, DR-55). The
 * attributes form is rendered in admin mode (§9.5). The open section is
 * URL-addressable via `?regTab`.
 */

import { Box, Button, Group, ScrollArea, Select, Stack, Tabs, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiEvent, AugmentedRegistration, Hash, RegistrationTypeLookup } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { deriveAdminUiSchema, JsonSchemaForm } from 'components/form';
import { HistoryPanel } from 'components/History';
import { JsonViewer } from 'components/JsonViewer';
import { CanEdit, ReadOnlyFieldset, usePermissions } from 'hooks/permissions';
import { useSearchTab } from 'hooks/useSearchTab';
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
  const { canEdit } = usePermissions();

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
  const [tab, setTab] = useSearchTab('regTab', [
    'attributes',
    ...(hasAdmin ? ['admin'] : []),
    'fees',
    'campers',
    ...(canEdit ? ['history'] : []),
    'raw',
  ]);

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

  const confirmDeleteRegistration = () =>
    confirmDelete({
      path: 'registrations',
      id: registration.id,
      title: 'Delete registration',
      message: <>Delete the registration for “{registration.registrant_email}”?</>,
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
          {canEdit && <Tabs.Tab value="history">History</Tabs.Tab>}
          <Tabs.Tab value="raw">Raw</Tabs.Tab>
        </Tabs.List>
        <ScrollArea style={{ flex: 1, minHeight: 0 }} offsetScrollbars>
          <Box py="md">
            <Tabs.Panel value="attributes">
              <Stack>
                <ReadOnlyFieldset>
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
                  </Stack>
                </ReadOnlyFieldset>
                <JsonSchemaForm
                  schema={event.registration_schema}
                  uiSchema={adminUiSchema}
                  formData={attributes}
                  templateData={{
                    ...event.registration_template_vars,
                    pricing: event.pricing,
                    formData: registration.attributes,
                    totals: registration.server_pricing_results,
                  }}
                  // Validation messages show as the admin edits, but never
                  // block saving (admins may need to save partial or legacy data).
                  liveValidate
                  errorMessages={{ rules: event.registration_error_messages }}
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
              <RegistrationCampers event={event} registration={registration} />
            </Tabs.Panel>
            {canEdit && (
              <Tabs.Panel value="history">
                {tab === 'history' && (
                  <HistoryPanel event={event} path="registrations" id={registration.id} />
                )}
              </Tabs.Panel>
            )}
            <Tabs.Panel value="raw">
              <JsonViewer value={registration} />
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
          <Button
            variant="light"
            color="red"
            onClick={confirmDeleteRegistration}
            loading={del.isPending}
          >
            Delete
          </Button>
        </Group>
      </CanEdit>
    </Box>
  );
}
