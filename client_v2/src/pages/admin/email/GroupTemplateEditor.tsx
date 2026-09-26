/**
 * Create or edit a group email template (SPEC §8.9; §15 DR-45): its name, its
 * default audience (who it goes to — see AudienceEditor), its sender (the
 * account, from and reply-to; blank uses the event's), and its subject and
 * body in Jinja, previewed for the recipients the audience reaches. The
 * server checks the Jinja, the expressions and the conditions when it's saved.
 */

import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiEmailTemplate, EmailAudience } from 'api-types';
import { type EmailSample, EmailTemplateEditor } from 'components/EmailTemplateEditor';
import { completeFilter, unfinishedRules } from 'components/RecipientFilterBuilder';
import { useMemo, useState } from 'react';
import { emailAccountHooks, emailTemplateHooks } from 'store/entities';
import { useAudience, useRecipientFields } from 'store/groupEmail';
import { ApiError, apiErrorMessage } from 'utils/fetch';

import { audienceOf, CONTEXT_FOR_SOURCE } from './audience';
import { AudienceEditor } from './AudienceEditor';

/** How many of the audience's recipients the preview can be rendered for. */
const SAMPLE_LIMIT = 50;

/** The event's account (the Select's value for "no account chosen"). */
const EVENT_ACCOUNT = 'event';

interface GroupTemplateEditorProps {
  eventId: string | number;
  organizationId: number;
  /** The event's sending address (a blank "From" uses it). */
  defaultFrom: string;
  /** Omitted for a new template. */
  template?: ApiEmailTemplate;
  /** The Template Help page (without a context). */
  helpBase?: string;
  onDone: (saved?: ApiEmailTemplate) => void;
}

/** The first message for each field of a 400 response. */
function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') return {};
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.body as Record<string, unknown>)) {
    const message: unknown = Array.isArray(messages) ? messages[0] : messages;
    if (typeof message === 'string') errors[field] = message;
  }
  return errors;
}

export function GroupTemplateEditor({
  eventId,
  organizationId,
  defaultFrom,
  template,
  helpBase,
  onDone,
}: GroupTemplateEditorProps) {
  const create = emailTemplateHooks.useCreate();
  const update = emailTemplateHooks.useUpdate();
  const { data: accounts } = emailAccountHooks.useList({ organization: organizationId });

  const [name, setName] = useState(template?.name ?? '');
  const [audience, setAudience] = useState<EmailAudience>(() => audienceOf(template));
  const [account, setAccount] = useState<number | null>(template?.account ?? null);
  const [fromEmail, setFromEmail] = useState(template?.from_email ?? '');
  const [replyTo, setReplyTo] = useState(template?.reply_to ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');

  const source = audience.recipient_source;
  const { data: fields } = useRecipientFields(eventId, source);
  // Count with the finished conditions only, so a half-built one doesn't blank the count.
  const previewAudience = useMemo(
    () => ({ ...audience, filter: completeFilter(audience.filter, fields) }),
    [audience, fields],
  );
  const preview = useAudience(eventId, previewAudience, template?.id);
  const context = CONTEXT_FOR_SOURCE[source];

  const samples = useMemo<EmailSample[]>(
    () =>
      (preview.data?.recipients ?? []).slice(0, SAMPLE_LIMIT).map((r) => ({
        value: r.key,
        label: `${r.label} — ${r.email}`,
        sample: {
          ...(r.registration ? { registration_id: r.registration } : {}),
          ...(r.camper ? { camper_id: r.camper } : {}),
        },
      })),
    [preview.data],
  );

  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;
  const errors = fieldErrors(saveError);
  const unfinished = source === 'manual' ? 0 : unfinishedRules(audience.filter, fields);
  const missing = [
    !name.trim() && 'a name',
    !subject.trim() && 'a subject',
    unfinished && `a field and value for ${unfinished === 1 ? 'a condition' : 'each condition'}`,
  ]
    .filter(Boolean)
    .join(', ');

  const save = () => {
    const fields = {
      name: name.trim(),
      ...audience,
      // Rows never given a field are dropped rather than saved.
      filter: {
        combinator: audience.filter.combinator ?? 'and',
        rules: (audience.filter.rules ?? []).filter((rule) => rule.field),
      },
      account,
      from_email: fromEmail.trim(),
      reply_to: replyTo.trim(),
      subject,
      body,
    };
    const onSuccess = (saved: ApiEmailTemplate) => {
      notifications.show({ color: 'green', message: 'Template saved' });
      onDone(saved);
    };
    if (template) update.mutate({ id: template.id, ...fields }, { onSuccess });
    else create.mutate({ event: Number(eventId), purpose: 'group', ...fields }, { onSuccess });
  };

  const accountOptions = [
    { value: EVENT_ACCOUNT, label: 'The event’s account' },
    ...(accounts ?? []).map((a) => ({ value: String(a.id), label: a.name })),
  ];

  return (
    <Stack>
      <TextInput
        label="Name"
        description="For finding it again; recipients don’t see it."
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        error={errors.name}
        withAsterisk
      />

      <Title order={4}>Recipients</Title>
      <AudienceEditor
        eventId={eventId}
        audience={audience}
        onChange={setAudience}
        resolution={preview.data}
        checking={preview.isFetching}
        error={preview.error ? apiErrorMessage(preview.error) : null}
        fieldErrors={errors}
      />
      <Text size="sm" c="dimmed">
        These are the default recipients. Before sending, you review exactly who gets it. Anyone who
        unsubscribed from this event’s group email is left out, and each copy ends with an
        unsubscribe link.
      </Text>

      <Title order={4}>Sender</Title>
      <Group grow align="flex-start">
        <Select
          label="Account"
          data={accountOptions}
          value={account === null ? EVENT_ACCOUNT : String(account)}
          onChange={(value) => setAccount(!value || value === EVENT_ACCOUNT ? null : Number(value))}
          allowDeselect={false}
          error={errors.account}
        />
        <TextInput
          label="From"
          placeholder={defaultFrom || 'The event’s address'}
          description="Blank uses the placeholder."
          value={fromEmail}
          onChange={(e) => setFromEmail(e.currentTarget.value)}
          error={errors.from_email}
        />
        <TextInput
          label="Reply-To"
          placeholder="The account’s default, else From"
          value={replyTo}
          onChange={(e) => setReplyTo(e.currentTarget.value)}
          error={errors.reply_to}
        />
      </Group>

      <Title order={4}>Message</Title>
      <EmailTemplateEditor
        eventId={eventId}
        context={context}
        subject={subject}
        onSubjectChange={setSubject}
        body={body}
        onBodyChange={setBody}
        samples={samples}
        helpHref={helpBase ? `${helpBase}?context=${context}` : undefined}
      />
      {(errors.subject || errors.body) && (
        <Alert color="red" variant="light" title="The message has problems">
          {[errors.subject && `Subject: ${errors.subject}`, errors.body && `Body: ${errors.body}`]
            .filter(Boolean)
            .join(' ')}
        </Alert>
      )}
      {saveError && !Object.keys(errors).length && (
        <Alert color="red" variant="light" title="Couldn’t save">
          {apiErrorMessage(saveError)}
        </Alert>
      )}

      {missing && (
        <Text size="sm" c="dimmed">
          Add {missing} to save.
        </Text>
      )}
      <Group>
        <Button onClick={save} disabled={!!missing || saving} loading={saving}>
          Save
        </Button>
        <Button variant="default" onClick={() => onDone()}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
