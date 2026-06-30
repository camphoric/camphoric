/**
 * Settings (SPEC §8.8). Edit the event's JSON configuration directly in Monaco,
 * each field saving back to the event via PATCH:
 *   - Schemas: camper, registration, registration UI, deposit, payment.
 *   - Pricing logic: camper, registration.
 *   - Admin attribute schemas: registration, camper.
 * Registration types are managed with invitations (§8.4), not here (DR-11).
 */

import { Alert, Button, Container, Group, Stack, Tabs, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams } from '@tanstack/react-router';
import type { ApiEvent } from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import { FullScreenLoading } from 'components/Loading';
import { useMemo, useState } from 'react';
import { eventHooks } from 'store/entities';

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

function SchemaEditor({ event, field }: { event: ApiEvent; field: EditableField }) {
  const update = eventHooks.useUpdate();
  const [text, setText] = useState(() => JSON.stringify(event[field] ?? {}, null, 2));

  const parseError = useMemo(() => {
    try {
      JSON.parse(text);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, [text]);

  const save = () => {
    const parsed: unknown = JSON.parse(text);
    const patch: Partial<ApiEvent> & { id: number } = { id: event.id };
    (patch as Record<string, unknown>)[field] = parsed;
    update.mutate(patch, {
      onSuccess: () => notifications.show({ color: 'green', message: 'Saved' }),
    });
  };

  return (
    <Stack>
      <JsonEditor value={text} onChange={setText} />
      {parseError ? (
        <Alert color="red" variant="light" title="Invalid JSON">
          {parseError}
        </Alert>
      ) : null}
      <Group>
        <Button onClick={save} disabled={!!parseError} loading={update.isPending}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

export function EventAdminSettings() {
  const { eventId } = useParams({ from: '/admin/organization/$organizationId/event/$eventId' });
  const { data: event } = eventHooks.useById(eventId);

  if (!event) return <FullScreenLoading />;

  return (
    <Container size="lg">
      <Stack>
        <Title order={2}>Settings</Title>
        <Tabs defaultValue={EDITABLE_FIELDS[0].field} orientation="vertical">
          <Tabs.List>
            {EDITABLE_FIELDS.map(({ field, title }) => (
              <Tabs.Tab key={field} value={field}>
                {title}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {EDITABLE_FIELDS.map(({ field }) => (
            <Tabs.Panel key={field} value={field} pl="md">
              <SchemaEditor event={event} field={field} />
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
