/**
 * Send an organization's email to past campers (SPEC §8.12; §15 DR-182). The
 * organizer reviews exactly who gets it — the people its rules reach, each with
 * a checkbox — sees who's left out and why, skips those it already reached,
 * sets the sender, sends now or later, and can send a test to themselves.
 * Sending asks for confirmation, restating what will happen, then creates the
 * send; the list is checked again then, so no one gets it twice.
 */

import {
  Alert,
  Anchor,
  Button,
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
import type { ApiEmailBatch, ApiOrganizationEmail } from 'api-types';
import { CanEdit } from 'hooks/permissions';
import { useMemo, useState } from 'react';
import { emailAccountHooks } from 'store/entities';
import {
  useOrganizationAudience,
  useSendOrganizationEmail,
  useTestOrganizationEmail,
} from 'store/multiEventEmail';
import { apiErrorMessage } from 'utils/fetch';

import { SkippedTable } from '../../email/AudienceEditor';
import { formatTime } from '../../email/emailLabels';
import { RecipientReviewTable } from '../../email/RecipientReviewTable';
import { localToIso } from '../../email/SendDialog';

/** The server's default mailer (the Select's value for "no account chosen"). */
const DEFAULT_ACCOUNT = 'default';

interface OrganizationSendDialogProps {
  email: ApiOrganizationEmail;
  onClose: () => void;
  onSent: (batch: ApiEmailBatch) => void;
  /** For tests; defaults to the current time. */
  now?: () => Date;
}

export function OrganizationSendDialog({
  email,
  onClose,
  onSent,
  now = () => new Date(),
}: OrganizationSendDialogProps) {
  const { data: accounts } = emailAccountHooks.useList({ organization: email.organization });
  const send = useSendOrganizationEmail();
  const test = useTestOrganizationEmail();
  const audience = useOrganizationAudience(email.organization, email.filter, email.id);
  const recipients = useMemo(() => audience.data?.recipients ?? [], [audience.data]);
  const skipped = audience.data?.skipped ?? [];
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selected = useMemo(
    () => picked ?? new Set(recipients.map((r) => r.key)),
    [picked, recipients],
  );

  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const [account, setAccount] = useState<number | null>(email.account);
  const [fromEmail, setFromEmail] = useState(email.from_email);
  const [replyTo, setReplyTo] = useState(email.reply_to);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [sendAt, setSendAt] = useState<string | null>(null);

  const chosen = recipients.filter((r) => selected.has(r.key));
  const alreadySent = chosen.filter((r) => r.already_sent).length;
  const toSend = skipAlreadySent ? chosen.length - alreadySent : chosen.length;
  const anyAlreadySent = recipients.some((r) => r.already_sent);
  const accountName =
    account === null
      ? 'the server’s default account'
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

  const sendTest = () =>
    test.mutate(
      { emailId: email.id, ...(chosen[0] ? { recipient_key: chosen[0].key } : {}) },
      {
        onSuccess: (result) =>
          notifications.show({
            color: 'green',
            message: `Test queued to ${result.message.to}, written for ${result.rendered_for.label}.`,
          }),
        onError: (error) => notifications.show({ color: 'red', message: apiErrorMessage(error) }),
      },
    );

  const confirmSend = () =>
    modals.openConfirmModal({
      title: later ? 'Schedule this email?' : 'Send this email?',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            “{email.name}” goes to <b>{toSend}</b> {toSend === 1 ? 'person' : 'people'} from{' '}
            {fromEmail.trim()}, through {accountName}.
          </Text>
          {skipAlreadySent && alreadySent > 0 && (
            <Text size="sm">
              {alreadySent} already received it and {alreadySent === 1 ? 'is' : 'are'} skipped.
            </Text>
          )}
          {skipped.length > 0 && (
            <Text size="sm">
              {skipped.length} left out (no address, unsubscribed, a duplicate address…).
            </Text>
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
            emailId: email.id,
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

  if (!audience.data) {
    return audience.error ? (
      <Alert color="red" variant="light" title="Couldn’t find the recipients">
        {apiErrorMessage(audience.error)}
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
        Subject: {email.subject || 'No subject'}
      </Text>
      <Title order={4} aria-live="polite">
        Recipients: {chosen.length} of {recipients.length} selected
      </Title>
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
          data={[
            { value: DEFAULT_ACCOUNT, label: 'The server’s default' },
            ...(accounts ?? []).map((a) => ({ value: String(a.id), label: a.name })),
          ]}
          value={account === null ? DEFAULT_ACCOUNT : String(account)}
          onChange={(value) =>
            setAccount(!value || value === DEFAULT_ACCOUNT ? null : Number(value))
          }
          allowDeselect={false}
        />
        <TextInput
          label="From"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.currentTarget.value)}
          error={fromEmail.trim() ? null : 'Give the address it’s from.'}
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
          onChange={(value) => setWhen(value)}
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
        <CanEdit>
          <Button variant="default" onClick={sendTest} loading={test.isPending}>
            Send a test to me
          </Button>
        </CanEdit>
        <Group>
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <CanEdit>
            <Button
              onClick={confirmSend}
              disabled={!toSend || !!laterProblem || !fromEmail.trim()}
              loading={send.isPending}
            >
              {later ? 'Schedule for' : 'Send to'} {toSend} {toSend === 1 ? 'person' : 'people'}
            </Button>
          </CanEdit>
        </Group>
      </Group>
    </Stack>
  );
}
