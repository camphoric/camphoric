/**
 * Home / event configuration (SPEC §8.3). View and edit the event's top-level
 * configuration; saving persists via PATCH to the event. (The schema-driven JSON
 * config — schemas, pricing logic, admin attributes — is edited in Settings, §8.8.)
 * The confirmation email is the event's email template (§15 DR-45), edited in
 * Jinja with a preview for any completed registration, and saved with the rest.
 */

import {
  Button,
  Container,
  Divider,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DateInput, DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useParams } from '@tanstack/react-router';
import type { ApiEvent, Hash } from 'api-types';
import { type EmailSample, EmailTemplateEditor } from 'components/EmailTemplateEditor';
import { JsonViewer } from 'components/JsonViewer';
import { KeyValueEdit } from 'components/KeyValueEdit';
import { FullScreenLoading } from 'components/Loading';
import { TemplateEditor } from 'components/TemplateEditor';
import { useEffect, useMemo, useState } from 'react';
import { useTemplateDraft } from 'store/emailTemplates';
import { eventHooks, registrationHooks } from 'store/entities';
import { apiErrorMessage } from 'utils/fetch';

export function EventAdminHome() {
  const { organizationId, eventId } = useParams({
    from: '/admin/organization/$organizationId/event/$eventId',
  });
  const { data: event } = eventHooks.useById(eventId);
  const { data: registrations } = registrationHooks.useList({ event: eventId, completed: 1 });
  const samples = useMemo<EmailSample[]>(
    () =>
      (registrations ?? []).map((r) => ({
        value: String(r.id),
        label: `#${r.id} ${r.registrant_email}`,
        sample: { registration_id: r.id },
      })),
    [registrations],
  );
  const update = eventHooks.useUpdate();
  const confirmation = useTemplateDraft(event?.confirmation_template);
  const [form, setForm] = useState<ApiEvent | null>(null);
  const [showRaw, { toggle: toggleRaw }] = useDisclosure(false);

  useEffect(() => {
    if (event && !form) setForm(event);
  }, [event, form]);

  if (!event || !form || !confirmation.loaded) return <FullScreenLoading />;

  const set = <K extends keyof ApiEvent>(field: K, value: ApiEvent[K]) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  const save = async () => {
    try {
      await update.mutateAsync({
        id: event.id,
        name: form.name,
        start: form.start,
        end: form.end,
        registration_start: form.registration_start,
        registration_end: form.registration_end,
        default_stay_length: form.default_stay_length,
        confirmation_page_template: form.confirmation_page_template,
        confirmation_email_from: form.confirmation_email_from,
        paypal_enabled: form.paypal_enabled,
        paypal_client_id: form.paypal_client_id,
        epayment_handling: form.epayment_handling,
        pricing: form.pricing,
        registration_template_vars: form.registration_template_vars,
      });
      await confirmation.save();
      notifications.show({ color: 'green', message: 'Event saved' });
    } catch (error) {
      notifications.show({ color: 'red', message: apiErrorMessage(error) });
    }
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
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Confirmation page message (markdown)
          </Text>
          <Text size="sm" c="dimmed">
            Shown when a registration completes; rendered on the server with the registration’s
            details, like the confirmation email.
          </Text>
          <TemplateEditor
            value={form.confirmation_page_template}
            onChange={(value) => set('confirmation_page_template', value)}
            eventId={eventId}
            context="confirmation_page"
            output="md"
            height={240}
            helpHref={`/admin/organization/${organizationId}/event/${eventId}/template-help?context=confirmation_page`}
          />
        </Stack>

        <Divider label="Confirmation email" />
        <TextInput
          label="From"
          description="Also where a report goes if a Jinja confirmation email can’t be rendered."
          value={form.confirmation_email_from}
          onChange={(e) => set('confirmation_email_from', e.currentTarget.value)}
        />
        <EmailTemplateEditor
          eventId={eventId}
          context="confirmation_email"
          subject={confirmation.subject}
          onSubjectChange={confirmation.setSubject}
          body={confirmation.body}
          onBodyChange={confirmation.setBody}
          samples={samples}
          helpHref={`/admin/organization/${organizationId}/event/${eventId}/template-help?context=confirmation_email`}
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
          <Button onClick={() => void save()} loading={update.isPending || confirmation.saving}>
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
