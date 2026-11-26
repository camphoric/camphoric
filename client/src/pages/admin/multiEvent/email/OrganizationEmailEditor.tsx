/**
 * Create or edit an organization's email to past campers (SPEC §8.12; §15
 * DR-182): its name, who it usually goes to (rules over each person's
 * attendance, the events they're registered for and their newest answers, with
 * how many that reaches and who's left out), its sender (one of the
 * organization's accounts, from and reply-to), and its subject and markdown
 * body in Jinja, previewed for a person it reaches. Saving from an older
 * version asks first (§9.8); closing with unsaved changes asks first.
 */

import { Alert, Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiOrganizationEmail, EmailFilter } from 'api-types';
import { FormActions } from 'components/FormActions';
import {
  completeFilter,
  EMPTY_FILTER,
  RecipientFilterBuilder,
  unfinishedRules,
} from 'components/RecipientFilterBuilder';
import { requestErrorMessage, TemplateEditorView } from 'components/TemplateEditor';
import { CanEdit, ReadOnlyFieldset, usePermissions } from 'hooks/permissions';
import { useConflictAwareSave, useLatestWhileUnchanged } from 'hooks/useEditableRecord';
import { useUnsavedChanges } from 'hooks/useUnsavedChanges';
import { useMemo, useState } from 'react';
import { emailAccountHooks, organizationEmailHooks } from 'store/entities';
import {
  useOrganizationAudience,
  useOrganizationEmailDescription,
  useOrganizationEmailPreview,
  useOrganizationRecipientFields,
} from 'store/multiEventEmail';
import { ApiError, apiErrorMessage } from 'utils/fetch';

import { AudienceSummary } from '../../email/AudienceEditor';

/** How many of the people reached the preview can be rendered for. */
const SAMPLE_LIMIT = 50;

/** The server's default mailer (the Select's value for "no account chosen"). */
const DEFAULT_ACCOUNT = 'default';

type Fields = Pick<
  ApiOrganizationEmail,
  'name' | 'filter' | 'account' | 'from_email' | 'reply_to' | 'subject' | 'body'
>;

const fieldsOf = (email?: ApiOrganizationEmail): Fields => ({
  name: email?.name ?? '',
  filter: email?.filter?.rules ? email.filter : EMPTY_FILTER,
  account: email?.account ?? null,
  from_email: email?.from_email ?? '',
  reply_to: email?.reply_to ?? '',
  subject: email?.subject ?? '',
  body: email?.body ?? '',
});

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

interface OrganizationEmailEditorProps {
  organizationId: string;
  /** Omitted for a new email. */
  email?: ApiOrganizationEmail;
  onDone: (saved?: ApiOrganizationEmail) => void;
}

export function OrganizationEmailEditor({
  organizationId,
  email: latest,
  onDone,
}: OrganizationEmailEditorProps) {
  const [initial, setInitial] = useState(() => fieldsOf(latest));
  const [fields, setFields] = useState(initial);
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));
  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);

  const [email, showVersion] = useLatestWhileUnchanged<ApiOrganizationEmail>(
    latest,
    (): boolean => !dirty,
    (record) => {
      setFields(fieldsOf(record));
      setInitial(fieldsOf(record));
    },
  );
  const { canEdit } = usePermissions();
  const create = organizationEmailHooks.useCreate();
  const update = organizationEmailHooks.useUpdate({ handlesVersionConflict: true });
  const saveEmail = useConflictAwareSave(
    email,
    {
      toForm: fieldsOf,
      saveRecord: update.mutateAsync,
      label: 'email',
      fieldLabels: { from_email: 'From', reply_to: 'Reply-to', filter: 'Recipients' },
    },
    true,
  );
  const { confirmDiscard, release } = useUnsavedChanges(dirty);
  const { data: accounts } = emailAccountHooks.useList({ organization: organizationId });

  const { data: recipientFields } = useOrganizationRecipientFields(organizationId);
  // Count with the finished conditions only, so a half-built one doesn't blank the count.
  const finished = useMemo(
    () => completeFilter(fields.filter, recipientFields),
    [fields.filter, recipientFields],
  );
  const audience = useOrganizationAudience(organizationId, finished, email?.id);

  const samples = (audience.data?.recipients ?? []).slice(0, SAMPLE_LIMIT);
  const [sampleKey, setSampleKey] = useState<string | null>(null);
  const reached = audience.data?.recipients;
  const previewKey =
    sampleKey && reached?.some((r) => r.key === sampleKey) ? sampleKey : reached?.[0]?.key;
  const sample = samples.find((r) => r.key === previewKey);
  const description = useOrganizationEmailDescription(organizationId);
  const previewRequest = useMemo(
    () =>
      previewKey
        ? {
            template: fields.body,
            subject: fields.subject,
            filter: finished,
            recipient_key: previewKey,
          }
        : null,
    [fields.body, fields.subject, finished, previewKey],
  );
  const preview = useOrganizationEmailPreview(organizationId, previewRequest);

  const saving = create.isPending || update.isPending;
  const saveError = create.error ?? update.error;
  const errors = fieldErrors(saveError);
  const unfinished = unfinishedRules(fields.filter, recipientFields);
  const missing = [
    !fields.name.trim() && 'a name',
    !fields.subject.trim() && 'a subject',
    !fields.from_email.trim() && 'a From address',
    unfinished && `a field and value for ${unfinished === 1 ? 'a condition' : 'each condition'}`,
  ]
    .filter(Boolean)
    .join(', ');

  const save = async () => {
    const values = {
      ...fields,
      name: fields.name.trim(),
      from_email: fields.from_email.trim(),
      reply_to: fields.reply_to.trim(),
      // Rows never given a field are dropped rather than saved.
      filter: {
        combinator: fields.filter.combinator ?? 'and',
        rules: (fields.filter.rules ?? []).filter((rule) => rule.field),
      } as EmailFilter,
    };
    const onSuccess = (saved: ApiOrganizationEmail) => {
      notifications.show({ color: 'green', message: 'Email saved' });
      release();
      onDone(saved);
    };
    if (email) {
      const outcome = await saveEmail(values, setFields);
      if (outcome?.saved) onSuccess(outcome.saved);
      if (outcome?.discarded) showVersion(outcome.discarded);
    } else create.mutate({ organization: Number(organizationId), ...values }, { onSuccess });
  };

  return (
    <Stack>
      <ReadOnlyFieldset>
        <TextInput
          label="Name"
          description="For finding it again; recipients don’t see it."
          value={fields.name}
          onChange={(e) => set('name', e.currentTarget.value)}
          error={errors.name}
          withAsterisk
        />
      </ReadOnlyFieldset>

      <Title order={4}>Recipients</Title>
      <Text size="sm" c="dimmed">
        People across the included events: each linked person once, and each record linked to no one
        on its own. A person’s address is their newest record’s that has one: the camper’s own
        email, else their registrant’s.
      </Text>
      <RecipientFilterBuilder
        value={fields.filter}
        onChange={(filter) => set('filter', filter)}
        fields={recipientFields ?? []}
        everyone="person"
        error={errors.filter}
        disabled={!canEdit}
      />
      {audience.data && (
        <AudienceSummary resolution={audience.data} checking={audience.isFetching} />
      )}
      {audience.error && (
        <Alert color="red" variant="light">
          {apiErrorMessage(audience.error)}
        </Alert>
      )}
      <Text size="sm" c="dimmed">
        These are the usual recipients; you review exactly who gets it each time it’s sent. Anyone
        who unsubscribed from these emails, or from an included event’s group email, is left out,
        and each copy ends with an unsubscribe link.
      </Text>

      <Title order={4}>Sender</Title>
      <ReadOnlyFieldset>
        <Group grow align="flex-start">
          <Select
            label="Account"
            data={[
              { value: DEFAULT_ACCOUNT, label: 'The server’s default' },
              ...(accounts ?? []).map((a) => ({ value: String(a.id), label: a.name })),
            ]}
            value={fields.account === null ? DEFAULT_ACCOUNT : String(fields.account)}
            onChange={(value) =>
              set('account', !value || value === DEFAULT_ACCOUNT ? null : Number(value))
            }
            allowDeselect={false}
            error={errors.account}
          />
          <TextInput
            label="From"
            value={fields.from_email}
            onChange={(e) => set('from_email', e.currentTarget.value)}
            error={errors.from_email}
            withAsterisk
          />
          <TextInput
            label="Reply-To"
            placeholder="The account’s default, else From"
            value={fields.reply_to}
            onChange={(e) => set('reply_to', e.currentTarget.value)}
            error={errors.reply_to}
          />
        </Group>
      </ReadOnlyFieldset>

      <Title order={4}>Message</Title>
      <TextInput
        label="Subject"
        description="A Jinja template too, e.g. {{ person.name }}, come back to camp"
        value={fields.subject}
        onChange={(e) => set('subject', e.currentTarget.value)}
        readOnly={!canEdit}
        error={errors.subject}
      />
      {samples.length > 1 && (
        <Select
          label="Preview for"
          data={samples.map((r) => ({ value: r.key, label: `${r.label} — ${r.email}` }))}
          value={sample?.key ?? null}
          onChange={setSampleKey}
          searchable
          allowDeselect={false}
          w={420}
        />
      )}
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Body (markdown)
        </Text>
        <TemplateEditorView
          value={fields.body}
          onChange={(value) => set('body', value)}
          context="multi_event_email"
          output="email"
          description={description.data}
          preview={preview.data}
          rendering={preview.isFetching}
          previewError={
            !sample
              ? 'The preview needs someone the recipients reach.'
              : preview.error
                ? requestErrorMessage(preview.error)
                : null
          }
          title="Email body"
        />
      </Stack>
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

      <FormActions dirty={dirty} justify="flex-start">
        <CanEdit>
          <Button onClick={() => void save()} disabled={!!missing || saving} loading={saving}>
            Save
          </Button>
        </CanEdit>
        <Button variant="default" onClick={() => confirmDiscard(() => onDone())}>
          {canEdit ? 'Cancel' : 'Close'}
        </Button>
        {missing && canEdit && (
          <Text size="sm" c="dimmed">
            Add {missing} to save.
          </Text>
        )}
      </FormActions>
    </Stack>
  );
}
