/**
 * Home / event configuration (SPEC §8.3). View and edit the event's top-level
 * configuration; saving persists via PATCH to the event. (The schema-driven JSON
 * config — schemas, pricing logic, admin attributes — is edited in Settings, §8.8.)
 */

import {
  Button,
  Container,
  Divider,
  Group,
  NumberInput,
  Stack,
  Switch,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { DateInput, DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useParams } from '@tanstack/react-router';
import type { ApiEvent, Hash } from 'api-types';
import { JsonViewer } from 'components/JsonViewer';
import { KeyValueEdit } from 'components/KeyValueEdit';
import { FullScreenLoading } from 'components/Loading';
import { useEffect, useState } from 'react';
import { eventHooks } from 'store/entities';

export function EventAdminHome() {
  const { eventId } = useParams({ from: '/admin/organization/$organizationId/event/$eventId' });
  const { data: event } = eventHooks.useById(eventId);
  const update = eventHooks.useUpdate();
  const [form, setForm] = useState<ApiEvent | null>(null);
  const [showRaw, { toggle: toggleRaw }] = useDisclosure(false);

  useEffect(() => {
    if (event && !form) setForm(event);
  }, [event, form]);

  if (!event || !form) return <FullScreenLoading />;

  const set = <K extends keyof ApiEvent>(field: K, value: ApiEvent[K]) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const save = () => {
    update.mutate(
      {
        id: event.id,
        name: form.name,
        start: form.start,
        end: form.end,
        registration_start: form.registration_start,
        registration_end: form.registration_end,
        default_stay_length: form.default_stay_length,
        confirmation_page_template: form.confirmation_page_template,
        confirmation_email_from: form.confirmation_email_from,
        confirmation_email_subject: form.confirmation_email_subject,
        confirmation_email_template: form.confirmation_email_template,
        paypal_enabled: form.paypal_enabled,
        paypal_client_id: form.paypal_client_id,
        epayment_handling: form.epayment_handling,
        pricing: form.pricing,
        registration_template_vars: form.registration_template_vars,
      },
      { onSuccess: () => notifications.show({ color: 'green', message: 'Event saved' }) },
    );
  };

  return (
    <Container size="md">
      <Stack>
        <Title order={2}>Event configuration</Title>

        <TextInput
          label="Name"
          value={form.name}
          onChange={(e) => set('name', e.currentTarget.value)}
        />
        <Group grow>
          <DateInput
            label="Event starts"
            valueFormat="MM/DD/YYYY"
            value={form.start || null}
            onChange={(value) => set('start', value ?? '')}
          />
          <DateInput
            label="Event ends"
            valueFormat="MM/DD/YYYY"
            value={form.end || null}
            onChange={(value) => set('end', value ?? '')}
          />
        </Group>
        <Group grow>
          <DateTimePicker
            label="Registration opens"
            valueFormat="MM/DD/YYYY h:mm A"
            value={form.registration_start || null}
            onChange={(value) => set('registration_start', value ?? '')}
          />
          <DateTimePicker
            label="Registration closes"
            valueFormat="MM/DD/YYYY h:mm A"
            value={form.registration_end || null}
            onChange={(value) => set('registration_end', value ?? '')}
          />
        </Group>
        <NumberInput
          label="Default stay length (days)"
          value={form.default_stay_length}
          min={0}
          onChange={(value) => set('default_stay_length', Number(value) || 0)}
        />

        <Divider label="Confirmation page" />
        <Textarea
          label="Confirmation page message"
          autosize
          minRows={3}
          value={form.confirmation_page_template}
          onChange={(e) => set('confirmation_page_template', e.currentTarget.value)}
        />

        <Divider label="Confirmation email" />
        <Group grow>
          <TextInput
            label="From"
            value={form.confirmation_email_from}
            onChange={(e) => set('confirmation_email_from', e.currentTarget.value)}
          />
          <TextInput
            label="Subject"
            value={form.confirmation_email_subject}
            onChange={(e) => set('confirmation_email_subject', e.currentTarget.value)}
          />
        </Group>
        <Textarea
          label="Confirmation email body"
          autosize
          minRows={3}
          value={form.confirmation_email_template}
          onChange={(e) => set('confirmation_email_template', e.currentTarget.value)}
        />

        <Divider label="Payments" />
        <Switch
          label="PayPal enabled"
          checked={form.paypal_enabled}
          onChange={(e) => set('paypal_enabled', e.currentTarget.checked)}
        />
        <Group grow>
          <TextInput
            label="PayPal client ID"
            value={form.paypal_client_id}
            onChange={(e) => set('paypal_client_id', e.currentTarget.value)}
          />
          <NumberInput
            label="E-payment handling (%)"
            value={form.epayment_handling}
            min={0}
            onChange={(value) => set('epayment_handling', Number(value) || 0)}
          />
        </Group>

        <Divider label="Pricing" />
        <KeyValueEdit
          value={form.pricing}
          valueType="integer"
          onChange={(value) => set('pricing', value as Hash<number>)}
        />

        <Divider label="Registration template values" />
        <KeyValueEdit
          value={form.registration_template_vars}
          valueType="string"
          onChange={(value) => set('registration_template_vars', value as Hash<string>)}
        />

        <Group>
          <Button onClick={save} loading={update.isPending}>
            Save
          </Button>
          <Button variant="subtle" onClick={toggleRaw}>
            {showRaw ? 'Hide' : 'Show'} raw JSON
          </Button>
        </Group>
        {showRaw ? <JsonViewer value={form} /> : null}
      </Stack>
    </Container>
  );
}
