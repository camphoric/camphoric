/**
 * Send a group email (SPEC §8.9; §15 DR-45). The admin reviews exactly who
 * gets it — the template's default recipients, each with a checkbox — and can
 * choose more with an ad-hoc filter (added to the list, or replacing it), see
 * who's left out and why, skip those it already reached, set the sender, send
 * now or later, and send a test to themselves. Sending asks for confirmation,
 * restating what will happen, then creates the batch.
 */

import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type {
  ApiEmailBatch,
  ApiEmailTemplate,
  ApiEvent,
  AudienceRecipient,
  AudienceSkipped,
  EmailAudience,
} from 'api-types';
import { completeFilter, EMPTY_FILTER } from 'components/RecipientFilterBuilder';
import { useMemo, useState } from 'react';
import { emailAccountHooks } from 'store/entities';
import {
  useAudience,
  useRecipientFields,
  useSendTemplate,
  useTestTemplate,
} from 'store/groupEmail';
import { apiErrorMessage } from 'utils/fetch';

import { audienceOf } from './audience';
import { AudienceEditor, SkippedTable } from './AudienceEditor';
import { formatTime } from './emailLabels';
import { RecipientReviewTable } from './RecipientReviewTable';

/** The event's account (the Select's value for "no account chosen"). */
const EVENT_ACCOUNT = 'event';

/** A DateTimePicker value (`YYYY-MM-DD HH:mm:ss`, local time) as an ISO instant. */
export function localToIso(value: string) {
  const [date, time = '00:00:00'] = value.split(' ');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s = 0] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
}

interface RecipientList {
  recipients: AudienceRecipient[];
  skipped: AudienceSkipped[];
}

interface SendDialogProps {
  event: ApiEvent;
  template: ApiEmailTemplate;
  onClose: () => void;
  onSent: (batch: ApiEmailBatch) => void;
  /** For tests; defaults to the current time. */
  now?: () => Date;
}

export function SendDialog({
  event,
  template,
  onClose,
  onSent,
  now = () => new Date(),
}: SendDialogProps) {
  const { data: accounts } = emailAccountHooks.useList({ organization: event.organization });
  const send = useSendTemplate();
  const test = useTestTemplate();

  // The template's default recipients, until the admin replaces or adds to them.
  const defaults = useAudience(event.id, audienceOf(template), template.id);
  const [list, setList] = useState<RecipientList | null>(null);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const recipients = list?.recipients ?? defaults.data?.recipients ?? [];
  const skipped = list?.skipped ?? defaults.data?.skipped ?? [];
  const selected = useMemo(
    () =>
      picked ?? new Set((list?.recipients ?? defaults.data?.recipients ?? []).map((r) => r.key)),
    [picked, list, defaults.data],
  );

  // Choosing more recipients: an ad-hoc filter over the template's source.
  const [choosing, setChoosing] = useState(false);
  const [adhoc, setAdhoc] = useState<EmailAudience>(() => ({
    ...audienceOf(template),
    filter: EMPTY_FILTER,
    filter_expression: '',
  }));
  const { data: fields } = useRecipientFields(event.id, template.recipient_source);
  const more = useAudience(
    event.id,
    choosing ? { ...adhoc, filter: completeFilter(adhoc.filter, fields) } : null,
    template.id,
  );
  const known = new Set(recipients.map((r) => r.key));
  const additions = (more.data?.recipients ?? []).filter((r) => !known.has(r.key));

  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const [account, setAccount] = useState<number | null>(template.account);
  const [fromEmail, setFromEmail] = useState(template.from_email);
  const [replyTo, setReplyTo] = useState(template.reply_to);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [sendAt, setSendAt] = useState<string | null>(null);

  const chosen = recipients.filter((r) => selected.has(r.key));
  const alreadySent = chosen.filter((r) => r.already_sent).length;
  const toSend = skipAlreadySent ? chosen.length - alreadySent : chosen.length;
  const anyAlreadySent = recipients.some((r) => r.already_sent);

  const sender = fromEmail.trim() || event.confirmation_email_from;
  const accountName =
    account === null
      ? 'the event’s account'
      : (accounts?.find((a) => a.id === account)?.name ?? 'the chosen account');
  const later = when === 'later';
  const sendAtIso = later && sendAt ? localToIso(sendAt) : null;
  const laterProblem = !later
    ? null
    : !sendAtIso
      ? 'Choose when to send it.'
      : new Date(sendAtIso) <= now()
        ? 'Choose a time in the future.'
        : null;

  const add = () => {
    setList({
      recipients: [...recipients, ...additions],
      skipped: mergeSkipped(skipped, more.data?.skipped ?? []),
    });
    setPicked(new Set([...selected, ...additions.map((r) => r.key)]));
    setChoosing(false);
  };
  const replace = () => {
    const next = more.data?.recipients ?? [];
    setList({ recipients: next, skipped: more.data?.skipped ?? [] });
    setPicked(new Set(next.map((r) => r.key)));
    setChoosing(false);
  };

  const sendTest = () => {
    const first = chosen[0];
    test.mutate(
      {
        templateId: template.id,
        // Any of the source's recipients, found by key (they may come from an ad-hoc filter).
        ...(first
          ? {
              recipient_key: first.key,
              filter: EMPTY_FILTER,
              filter_expression: '',
              include_incomplete: true,
            }
          : {}),
      },
      {
        onSuccess: (result) =>
          notifications.show({
            color: 'green',
            message: `Test queued to ${result.message.to}, written for ${result.rendered_for.label}.`,
          }),
        onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
      },
    );
  };

  const confirmSend = () =>
    modals.openConfirmModal({
      title: later ? 'Schedule this email?' : 'Send this email?',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            “{template.name}” goes to <b>{toSend}</b> {toSend === 1 ? 'recipient' : 'recipients'}{' '}
            from {sender || 'the event’s address'}, through {accountName}.
          </Text>
          {skipAlreadySent && alreadySent > 0 && (
            <Text size="sm">
              {alreadySent} already received it and {alreadySent === 1 ? 'is' : 'are'} skipped.
            </Text>
          )}
          {skipped.length > 0 && (
            <Text size="sm">{skipped.length} left out (no address, a duplicate address…).</Text>
          )}
          <Text size="sm">
            {later && sendAtIso ? `It’s sent at ${formatTime(sendAtIso)}.` : 'It’s sent now.'}
          </Text>
        </Stack>
      ),
      labels: { confirm: later ? 'Schedule' : 'Send', cancel: 'Back' },
      onConfirm: () =>
        send.mutate(
          {
            templateId: template.id,
            recipient_keys: chosen.map((r) => r.key),
            account,
            from_email: fromEmail.trim(),
            reply_to: replyTo.trim(),
            skip_already_sent: skipAlreadySent,
            send_at: sendAtIso,
          },
          {
            onSuccess: onSent,
            onError: (error) =>
              notifications.show({ color: 'red', message: apiErrorMessage(error) }),
          },
        ),
    });

  const accountOptions = [
    { value: EVENT_ACCOUNT, label: 'The event’s account' },
    ...(accounts ?? []).map((a) => ({ value: String(a.id), label: a.name })),
  ];

  if (!defaults.data && !list) {
    return defaults.error ? (
      <Alert color="red" variant="light" title="Couldn’t find the recipients">
        {apiErrorMessage(defaults.error)}
      </Alert>
    ) : (
      <Group gap="xs">
        <Loader size="sm" />
        <Text size="sm">Finding the recipients…</Text>
      </Group>
    );
  }

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Subject: {template.subject || 'No subject'}
      </Text>

      <Group justify="space-between" wrap="wrap">
        <Title order={4} aria-live="polite">
          Recipients: {chosen.length} of {recipients.length} selected
        </Title>
        {template.recipient_source !== 'manual' && !choosing && (
          <Button variant="light" size="xs" onClick={() => setChoosing(true)}>
            Choose more recipients
          </Button>
        )}
      </Group>

      {choosing && (
        <Card withBorder>
          <Stack gap="sm">
            <Text size="sm" fw={500}>
              Find recipients to add to the list, or to replace it with
            </Text>
            <AudienceEditor
              eventId={event.id}
              audience={adhoc}
              onChange={setAdhoc}
              resolution={more.data}
              checking={more.isFetching}
              error={more.error ? apiErrorMessage(more.error) : null}
              narrowOnly
            />
            <Group>
              <Button size="xs" onClick={add} disabled={!more.data || !additions.length}>
                Add {additions.length} new
              </Button>
              <Button size="xs" variant="default" onClick={replace} disabled={!more.data}>
                Replace the list with {more.data?.recipients.length ?? 0}
              </Button>
              <Button size="xs" variant="subtle" onClick={() => setChoosing(false)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      <RecipientReviewTable
        recipients={recipients}
        selected={selected}
        onSelectedChange={setPicked}
        skipAlreadySent={skipAlreadySent}
      />

      {skipped.length > 0 && (
        <Stack gap="xs">
          <Group gap="xs">
            <Text size="sm">{skipped.length} left out: they can’t be sent this email.</Text>
            <Anchor
              component="button"
              type="button"
              size="sm"
              onClick={() => setShowSkipped((s) => !s)}
            >
              {showSkipped ? 'Hide' : 'Show why'}
            </Anchor>
          </Group>
          {showSkipped && <SkippedTable skipped={skipped} />}
        </Stack>
      )}

      {anyAlreadySent && (
        <Switch
          label={`Only send to those who haven’t received this email yet (${alreadySent} selected already have)`}
          checked={skipAlreadySent}
          onChange={(e) => setSkipAlreadySent(e.currentTarget.checked)}
        />
      )}

      <Title order={4}>Sender</Title>
      <Group grow align="flex-start">
        <Select
          label="Account"
          data={accountOptions}
          value={account === null ? EVENT_ACCOUNT : String(account)}
          onChange={(value) => setAccount(!value || value === EVENT_ACCOUNT ? null : Number(value))}
          allowDeselect={false}
        />
        <TextInput
          label="From"
          placeholder={event.confirmation_email_from || 'The event’s address'}
          value={fromEmail}
          onChange={(e) => setFromEmail(e.currentTarget.value)}
        />
        <TextInput
          label="Reply-To"
          placeholder="The account’s default, else From"
          value={replyTo}
          onChange={(e) => setReplyTo(e.currentTarget.value)}
        />
      </Group>

      <Title order={4}>When</Title>
      <Group align="flex-start" wrap="wrap">
        <SegmentedControl
          aria-label="When"
          data={[
            { value: 'now', label: 'Now' },
            { value: 'later', label: 'Later' },
          ]}
          value={when}
          onChange={(value) => setWhen(value as 'now' | 'later')}
        />
        {later && (
          <DateTimePicker
            aria-label="Send at"
            placeholder="Date and time"
            valueFormat="MM/DD/YYYY h:mm A"
            value={sendAt}
            onChange={setSendAt}
            minDate={now()}
            error={sendAt ? laterProblem : null}
            w={240}
          />
        )}
      </Group>

      <Group justify="space-between" wrap="wrap">
        <Button variant="default" onClick={sendTest} loading={test.isPending}>
          Send a test to me
        </Button>
        <Group>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={confirmSend}
            disabled={!toSend || !!laterProblem}
            loading={send.isPending}
          >
            {later ? 'Schedule for' : 'Send to'} {toSend}{' '}
            {toSend === 1 ? 'recipient' : 'recipients'}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

/** Skipped entries from both lists, without repeating one. */
function mergeSkipped(a: AudienceSkipped[], b: AudienceSkipped[]) {
  const seen = new Set(a.map((s) => `${s.label}|${s.reason}`));
  return [...a, ...b.filter((s) => !seen.has(`${s.label}|${s.reason}`))];
}
