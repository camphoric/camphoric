/**
 * Compose a bulk email (SPEC §8.9): from, subject and body (the email template
 * editor, previewed for one of the chosen recipients), who it goes to, and an
 * optional sending rate. Saving stores the task; the recipient list is built
 * from the current data again when it's sent.
 */

import { Alert, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type {
  ApiBulkEmailTask,
  BulkRecipientCriteria,
  BulkRecipientKind,
  TemplateContextName,
  TemplateEngine,
} from 'api-types';
import { type EmailSample, EmailTemplateEditor } from 'components/EmailTemplateEditor';
import { useMemo, useState } from 'react';
import { useRecipientPreview } from 'store/bulkEmail';
import { bulkEmailTaskHooks } from 'store/entities';
import { ApiError } from 'utils/fetch';

import { EMPTY_CRITERIA, RecipientSelector } from './RecipientSelector';

export const CONTEXT_FOR_KIND: Record<BulkRecipientKind, TemplateContextName> = {
  registrations: 'bulk_email_registration',
  campers: 'bulk_email_camper',
  manual: 'bulk_email_manual',
};

const SAMPLE_LIMIT = 50;

interface BulkEmailComposerProps {
  eventId: string;
  /** The address new emails come from by default. */
  defaultFrom: string;
  /** Omitted when composing a new email. */
  task?: ApiBulkEmailTask;
  /** The Template Help page (without a context). */
  helpBase?: string;
  onDone: (taskId?: number) => void;
}

function criteriaOf(task?: ApiBulkEmailTask): BulkRecipientCriteria {
  if (!task) return EMPTY_CRITERIA;
  const {
    recipient_kind,
    recipient_list,
    recipient_filter,
    address_expression,
    name_expression,
    include_incomplete,
  } = task;
  return {
    recipient_kind,
    recipient_list,
    recipient_filter,
    address_expression,
    name_expression,
    include_incomplete,
  };
}

function requestError(error: unknown) {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const detail = (error.body as Record<string, unknown>).detail;
    if (typeof detail === 'string') return detail;
  }
  return error instanceof Error ? error.message : String(error);
}

export function BulkEmailComposer({
  eventId,
  defaultFrom,
  task,
  helpBase,
  onDone,
}: BulkEmailComposerProps) {
  const create = bulkEmailTaskHooks.useCreate();
  const update = bulkEmailTaskHooks.useUpdate();

  const [fromEmail, setFromEmail] = useState(task?.from_email ?? defaultFrom);
  const [engine, setEngine] = useState<TemplateEngine>(task?.engine ?? 'jinja');
  const [subject, setSubject] = useState(task?.subject ?? '');
  const [body, setBody] = useState(task?.body_template ?? '');
  const [criteria, setCriteria] = useState<BulkRecipientCriteria>(() => criteriaOf(task));
  const [rate, setRate] = useState<string | number>(task?.messages_per_second ?? '');

  const preview = useRecipientPreview(eventId, criteria);
  const context = CONTEXT_FOR_KIND[criteria.recipient_kind];

  const samples = useMemo<EmailSample[]>(
    () =>
      (preview.data?.recipients ?? []).slice(0, SAMPLE_LIMIT).map((r) => ({
        value: r.email,
        label: `${r.label} — ${r.email}`,
        sample: {
          ...(r.registration ? { registration_id: r.registration } : {}),
          ...(r.camper ? { camper_id: r.camper } : {}),
        },
      })),
    [preview.data],
  );

  const missing = [!fromEmail.trim() && 'a from address', !subject.trim() && 'a subject']
    .filter(Boolean)
    .join(' and ');
  const saving = create.isPending || update.isPending;

  const save = () => {
    const fields = {
      from_email: fromEmail.trim(),
      engine,
      subject,
      body_template: body,
      ...criteria,
      messages_per_second: rate === '' ? null : String(rate),
    };
    const onSuccess = (saved: ApiBulkEmailTask) => {
      notifications.show({ color: 'green', message: 'Email saved' });
      onDone(saved.id);
    };
    if (task) update.mutate({ id: task.id, ...fields }, { onSuccess });
    else create.mutate({ event: eventId, ...fields }, { onSuccess });
  };

  return (
    <Stack>
      <Text fw={600}>{task ? 'Edit email' : 'New email'}</Text>
      <TextInput
        label="From"
        value={fromEmail}
        onChange={(e) => setFromEmail(e.currentTarget.value)}
        required
      />
      <RecipientSelector
        criteria={criteria}
        onChange={setCriteria}
        resolution={preview.data}
        checking={preview.isFetching}
        error={preview.error ? requestError(preview.error) : null}
      />
      <EmailTemplateEditor
        eventId={eventId}
        context={context}
        engine={engine}
        onEngineChange={setEngine}
        subject={subject}
        onSubjectChange={setSubject}
        body={body}
        onBodyChange={setBody}
        samples={samples}
        helpHref={helpBase ? `${helpBase}?context=${context}` : undefined}
      />
      {engine === 'mustache' && (
        <Alert variant="light" color="yellow">
          Mustache bulk emails only see <code>recipient.email</code> and{' '}
          <code>recipient.full_name</code>.
        </Alert>
      )}
      <NumberInput
        label="Messages per second"
        description="Leave blank to send as fast as the mail server allows."
        value={rate}
        onChange={setRate}
        min={0.001}
        decimalScale={3}
        w={240}
      />
      {missing && (
        <Text size="sm" c="dimmed">
          Add {missing} to save.
        </Text>
      )}
      <Group>
        <Button onClick={save} disabled={!!missing || saving} loading={saving}>
          Save
        </Button>
        <Button variant="default" onClick={() => onDone(task?.id)}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
