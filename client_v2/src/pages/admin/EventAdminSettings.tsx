/**
 * Settings (SPEC §8.8). Edit the event's JSON configuration directly in Monaco,
 * each field saving back to the event via PATCH, from the version it was
 * opened at, so saving over someone else's change asks first (§9.8, DR-109):
 *   - Schemas: camper, registration, registration UI, deposit, payment.
 *   - Pricing logic: camper, registration.
 *   - Admin attribute schemas: registration, camper.
 * Registration types are also managed here (§8.4, §15 DR-32), as are promo
 * codes (§15 DR-67), the registration form's custom validation messages (§15
 * DR-34) and the event's email account (§15 DR-44). The open tab is URL-addressable via `?settingsTab`.
 */

import { Alert, Button, Container, Stack, Tabs, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams } from '@tanstack/react-router';
import type { ApiEvent } from 'api-types';
import { EditLeaseNotice } from 'components/EditLease';
import { FormActions } from 'components/FormActions';
import { JsonEditor } from 'components/JsonEditor';
import { FullScreenLoading } from 'components/Loading';
import { CanEdit, ViewOnly } from 'hooks/permissions';
import { useConflictAwareSave, useLatestWhileUnchanged } from 'hooks/useEditableRecord';
import { useEditLease } from 'hooks/useEditLease';
import { useSearchTab } from 'hooks/useSearchTab';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { eventHooks } from 'store/entities';

import { EmailSettings } from './EmailSettings';
import { ErrorMessagesSettings } from './ErrorMessagesSettings';
import { PromoCodesSettings } from './PromoCodesSettings';
import { RegistrationTypesSettings } from './RegistrationTypesSettings';

const REGISTRATION_TYPES = 'registration_types';
const PROMO_CODES = 'promo_codes';
const VALIDATION_MESSAGES = 'validation_messages';
const EMAIL = 'email';

type EditableField = keyof Pick<
  ApiEvent,
  | 'camper_schema'
  | 'registration_schema'
  | 'registration_ui_schema'
  | 'camper_pricing_logic'
  | 'registration_pricing_logic'
  | 'deposit_schema'
  | 'payment_schema'
  | 'registration_admin_schema'
  | 'camper_admin_schema'
>;

const EDITABLE_FIELDS: { field: EditableField; title: string }[] = [
  { field: 'camper_schema', title: 'Camper schema' },
  { field: 'registration_schema', title: 'Registration schema' },
  { field: 'registration_ui_schema', title: 'Registration UI' },
  { field: 'camper_pricing_logic', title: 'Camper pricing' },
  { field: 'registration_pricing_logic', title: 'Registration pricing' },
  { field: 'deposit_schema', title: 'Deposit schema' },
  { field: 'payment_schema', title: 'Payment schema' },
  { field: 'registration_admin_schema', title: 'Registration admin attrs' },
  { field: 'camper_admin_schema', title: 'Camper admin attrs' },
];

const TABS = [
  REGISTRATION_TYPES,
  PROMO_CODES,
  VALIDATION_MESSAGES,
  EMAIL,
  ...EDITABLE_FIELDS.map(({ field }) => field),
];

const stringify = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

function SchemaEditor({
  event: latest,
  field,
  onDirtyChange,
}: {
  event: ApiEvent;
  field: EditableField;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const update = eventHooks.useUpdate({ handlesVersionConflict: true });
  // The version shown: a newer one shows while nothing here is unsaved.
  const [event, showVersion] = useLatestWhileUnchanged<ApiEvent>(
    latest,
    (): boolean => !dirty,
    (record) => {
      setText(stringify(record[field]));
      setSavedText(stringify(record[field]));
    },
  );
  const saveField = useConflictAwareSave(
    event,
    {
      toForm: (record: ApiEvent): Partial<ApiEvent> => ({ [field]: record[field] }),
      saveRecord: update.mutateAsync,
      label: 'event',
    },
    true,
  );
  const [text, setText] = useState(() => stringify(latest[field]));
  // The text as last opened or saved, to tell what's unsaved.
  const [savedText, setSavedText] = useState(text);
  const dirty = text !== savedText;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const parseError = useMemo(() => {
    try {
      JSON.parse(text);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, [text]);

  const save = async () => {
    const outcome = await saveField(
      { [field]: JSON.parse(text) as ApiEvent[EditableField] },
      (form) => setText(stringify(form[field])),
    );
    const record = outcome?.saved ?? outcome?.discarded;
    if (record) showVersion(record);
    if (outcome?.saved) notifications.show({ color: 'green', message: 'Saved' });
  };

  return (
    <Stack>
      <JsonEditor value={text} onChange={setText} />
      {parseError ? (
        <Alert color="red" variant="light" title="Invalid JSON">
          {parseError}
        </Alert>
      ) : null}
      <CanEdit>
        <FormActions justify="flex-start">
          <Button onClick={() => void save()} disabled={!!parseError} loading={update.isPending}>
            Save
          </Button>
        </FormActions>
      </CanEdit>
    </Stack>
  );
}

export function EventAdminSettings() {
  const { organizationId, eventId } = useParams({
    from: '/admin/organization/$organizationId/event/$eventId',
  });
  const { data: event } = eventHooks.useById(eventId);
  const [tab, setTab] = useSearchTab('settingsTab', TABS);
  // The tabs that edit the event's own fields share its edit lease (§9.8): held
  // while any of them has unsaved changes.
  const [unsaved, setUnsaved] = useState<ReadonlySet<string>>(new Set());
  const reportDirty = useCallback((key: string, dirty: boolean) => {
    setUnsaved((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  // One steady callback per tab, so each tab's effects don't run again every render.
  const reportersFor = useMemo(
    () =>
      Object.fromEntries(
        [VALIDATION_MESSAGES, ...EDITABLE_FIELDS.map(({ field }) => field)].map((key) => [
          key,
          (dirty: boolean) => reportDirty(key, dirty),
        ]),
      ),
    [reportDirty],
  );
  const lease = useEditLease(event ? 'event' : undefined, event?.id ?? 0, unsaved.size > 0);

  if (!event) return <FullScreenLoading />;

  return (
    <Container size="lg">
      <Stack>
        <Title order={2}>Settings</Title>
        <EditLeaseNotice label="event" lease={lease} />
        <Tabs value={tab} onChange={setTab} orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value={REGISTRATION_TYPES}>Registration types</Tabs.Tab>
            <Tabs.Tab value={PROMO_CODES}>Promo codes</Tabs.Tab>
            <Tabs.Tab value={VALIDATION_MESSAGES}>Validation messages</Tabs.Tab>
            <Tabs.Tab value={EMAIL}>Email</Tabs.Tab>
            {EDITABLE_FIELDS.map(({ field, title }) => (
              <Tabs.Tab key={field} value={field}>
                {title}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panel value={REGISTRATION_TYPES} pl="md">
            <RegistrationTypesSettings
              eventId={eventId}
              helpHref={`/admin/organization/${organizationId}/event/${eventId}/template-help?context=invitation_email`}
            />
          </Tabs.Panel>
          <Tabs.Panel value={PROMO_CODES} pl="md">
            <PromoCodesSettings eventId={eventId} />
          </Tabs.Panel>
          <Tabs.Panel value={VALIDATION_MESSAGES} pl="md">
            <ViewOnly when={lease.viewOnly}>
              <ErrorMessagesSettings
                key={event.id}
                event={event}
                onDirtyChange={reportersFor[VALIDATION_MESSAGES]}
              />
            </ViewOnly>
          </Tabs.Panel>
          <Tabs.Panel value={EMAIL} pl="md">
            {/* Its choices save at once, and its accounts are the organization's: never held. */}
            <EmailSettings event={event} />
          </Tabs.Panel>
          {EDITABLE_FIELDS.map(({ field }) => (
            <Tabs.Panel key={field} value={field} pl="md">
              <ViewOnly when={lease.viewOnly}>
                <SchemaEditor event={event} field={field} onDirtyChange={reportersFor[field]} />
              </ViewOnly>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
