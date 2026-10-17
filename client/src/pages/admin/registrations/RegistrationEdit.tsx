/**
 * Edit a registration (SPEC §8.4), organized into tabbed sections — Attributes
 * (registration type, promo code, registrant email, and the schema-driven form), Admin
 * attributes, Fees & payments, Campers, History (Registrars and Admins; its
 * changes and its campers', payments' and charges', DR-53), and a raw record for
 * debugging — with a pinned action bar (Save / Delete) always visible below the
 * scrolling section. Save persists `{ registrant_email, registration_type,
 * promo_code, attributes, admin_attributes }` in a single PATCH, of what changed and
 * from which version, so a change someone else saved meanwhile is never overwritten
 * unseen (§9.8, DR-109); the registration can be
 * deleted after confirming what that does, and restored later (DR-54, DR-55). The
 * attributes form is rendered in admin mode (§9.5). The open section is
 * URL-addressable via `?regTab`.
 */

import { Box, Button, ScrollArea, Select, Stack, Tabs, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type {
  ApiEvent,
  ApiRegistration,
  AugmentedRegistration,
  Hash,
  RegistrationTypeLookup,
  Scalar,
} from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { StaleRecordNotice } from 'components/EditConflict';
import { EditLeaseNotice } from 'components/EditLease';
import { deriveAdminUiSchema, JsonSchemaForm } from 'components/form';
import { FormActions } from 'components/FormActions';
import { HistoryPanel } from 'components/History';
import { JsonViewer } from 'components/JsonViewer';
import { CanEdit, ReadOnlyFieldset, usePermissions, ViewOnly } from 'hooks/permissions';
import { useEditableRecord } from 'hooks/useEditableRecord';
import { useSearchTab } from 'hooks/useSearchTab';
import { AdminAttributesForm } from 'pages/admin/AdminAttributesForm';
import { useMemo } from 'react';
import { promoCodeHooks, registrationHooks } from 'store/entities';

import { RegistrationInvoices } from './invoices';
import { RegistrationCampers } from './RegistrationCampers';

const NONE = 'none';

const toSelect = (id: Scalar | null | undefined) => (id == null ? NONE : String(id));
const fromSelect = (value: string | null) =>
  value == null || value === NONE ? null : Number(value);

/** What the attributes tab edits. */
const toForm = (registration: ApiRegistration) => ({
  registrant_email: registration.registrant_email,
  registration_type: registration.registration_type ?? null,
  promo_code: registration.promo_code ?? null,
  attributes: registration.attributes,
  admin_attributes: registration.admin_attributes,
});

const FIELD_LABELS = {
  registrant_email: 'Registrant email',
  registration_type: 'Registration type',
  promo_code: 'Promo code',
  admin_attributes: 'Admin attributes',
};

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
  const update = registrationHooks.useUpdate({ handlesVersionConflict: true });
  const del = registrationHooks.useDelete();
  const { form, setField, isStale, loadLatest, save, lease } = useEditableRecord(registration, {
    toForm,
    saveRecord: update.mutateAsync,
    label: 'registration',
    fieldLabels: FIELD_LABELS,
    lease: 'registration',
  });
  const { canEdit } = usePermissions();

  const { data: promoCodes } = promoCodeHooks.useList({ event: event.id });

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

  // Any of the event's codes, usable by registrants or not (§15, DR-67); a
  // deleted one the registration already has stays on it.
  const current = registration.promo;
  const promoOptions = [
    { value: NONE, label: 'None' },
    ...(promoCodes ?? []).map((p) => ({ value: String(p.id), label: `${p.label} (${p.code})` })),
    ...(current?.deleted
      ? [{ value: String(current.id), label: `${current.label} (${current.code}, deleted)` }]
      : []),
  ];

  const saveRegistration = async () => {
    if (await save()) notifications.show({ color: 'green', message: 'Registration saved' });
  };

  const confirmDeleteRegistration = () =>
    confirmDelete({
      path: 'registrations',
      id: registration.id,
      title: 'Delete registration',
      message: <>Delete the registration for “{registration.registrant_email}”?</>,
      onConfirm: () =>
        del.mutate(
          { id: registration.id, version: registration.version },
          { onSuccess: onDeleted },
        ),
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
            <EditLeaseNotice label="registration" lease={lease} />
            {isStale && <StaleRecordNotice label="registration" onLoadLatest={loadLatest} />}
            <Tabs.Panel value="attributes">
              <ViewOnly when={lease.viewOnly}>
                <Stack>
                  <ReadOnlyFieldset>
                    <Stack>
                      <Select
                        label="Registration type"
                        data={typeOptions}
                        value={toSelect(form.registration_type)}
                        onChange={(value) => setField('registration_type', fromSelect(value))}
                        allowDeselect={false}
                        maw={320}
                      />
                      <Select
                        label="Promo code"
                        description="Changing it reprices the registration."
                        data={promoOptions}
                        value={toSelect(form.promo_code)}
                        onChange={(value) => setField('promo_code', fromSelect(value))}
                        allowDeselect={false}
                        maw={320}
                      />
                      <TextInput
                        label="Registrant email"
                        value={form.registrant_email}
                        onChange={(e) => setField('registrant_email', e.currentTarget.value)}
                        maw={320}
                      />
                    </Stack>
                  </ReadOnlyFieldset>
                  <JsonSchemaForm
                    schema={event.registration_schema}
                    uiSchema={adminUiSchema}
                    formData={form.attributes}
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
                    onChange={(formData) => setField('attributes', formData as Hash)}
                  >
                    <></>
                  </JsonSchemaForm>
                </Stack>
              </ViewOnly>
            </Tabs.Panel>
            {hasAdmin && (
              <Tabs.Panel value="admin">
                <ViewOnly when={lease.viewOnly}>
                  <AdminAttributesForm
                    adminSchema={event.registration_admin_schema}
                    value={form.admin_attributes}
                    onChange={(value) => setField('admin_attributes', value)}
                  />
                </ViewOnly>
              </Tabs.Panel>
            )}
            <Tabs.Panel value="fees">
              <RegistrationInvoices event={event} registration={registration} />
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
      <ViewOnly when={lease.viewOnly}>
        <CanEdit>
          <FormActions justify="space-between">
            <Button onClick={() => void saveRegistration()} loading={update.isPending}>
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
          </FormActions>
        </CanEdit>
      </ViewOnly>
    </Box>
  );
}
