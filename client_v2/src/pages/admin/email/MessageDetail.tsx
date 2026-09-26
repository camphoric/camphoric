/**
 * One email in the history (SPEC §8.9): who it went to and from, how delivery
 * went (attempts, the error, the next try), and exactly what was sent. A failed
 * message can be retried; a queued one can be cancelled.
 */

import { Alert, Badge, Button, Code, Group, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { IconPlayerStop, IconRefresh } from '@tabler/icons-react';
import type { ApiEmailMessage } from 'api-types';
import { HtmlFrame } from 'components/HtmlFrame';
import type { ReactNode } from 'react';

import { formatTime, KIND_LABEL, STATUS_COLOR, STATUS_LABEL } from './emailLabels';

interface MessageDetailProps {
  message: ApiEmailMessage;
  onRetry?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Table.Tr>
      <Table.Th w={140}>{label}</Table.Th>
      <Table.Td>{children}</Table.Td>
    </Table.Tr>
  );
}

export function MessageDetail({ message, onRetry, onCancel, busy }: MessageDetailProps) {
  const waiting = message.status === 'queued' || message.status === 'sending';

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={4}>{message.subject}</Title>
          <Group gap="xs">
            <Badge variant="light" color={STATUS_COLOR[message.status]}>
              {STATUS_LABEL[message.status]}
            </Badge>
            <Badge variant="outline" color="gray">
              {KIND_LABEL[message.kind]}
            </Badge>
          </Group>
        </Stack>
        <Group gap="xs">
          {message.status === 'failed' && onRetry && (
            <Button leftSection={<IconRefresh size={16} />} onClick={onRetry} loading={busy}>
              Retry
            </Button>
          )}
          {message.status === 'queued' && onCancel && (
            <Button
              variant="default"
              color="red"
              leftSection={<IconPlayerStop size={16} />}
              onClick={onCancel}
              loading={busy}
            >
              Don't send
            </Button>
          )}
        </Group>
      </Group>

      {message.last_error && (
        <Alert color={message.status === 'failed' ? 'red' : 'yellow'} title="Last problem">
          {message.last_error}
        </Alert>
      )}

      <Table withRowBorders={false} verticalSpacing={4}>
        <Table.Tbody>
          <Row label="To">{message.to}</Row>
          <Row label="From">{message.from_email}</Row>
          {message.reply_to && <Row label="Reply to">{message.reply_to}</Row>}
          <Row label="Sent through">{message.account_name ?? 'The server’s default mailer'}</Row>
          <Row label="Queued">
            {formatTime(message.created_at)}
            {message.created_by_name ? ` by ${message.created_by_name}` : ''}
          </Row>
          {message.sent_at && <Row label="Sent">{formatTime(message.sent_at)}</Row>}
          {waiting && message.attempts > 0 && (
            <Row label="Next try">{formatTime(message.next_attempt_at)}</Row>
          )}
          <Row label="Attempts">{message.attempts}</Row>
        </Table.Tbody>
      </Table>

      <Tabs defaultValue={message.html ? 'html' : 'text'} keepMounted={false}>
        <Tabs.List>
          {message.html && <Tabs.Tab value="html">As sent</Tabs.Tab>}
          <Tabs.Tab value="text">Plain text</Tabs.Tab>
        </Tabs.List>
        {message.html && (
          <Tabs.Panel value="html" pt="sm">
            <HtmlFrame html={message.html} title={`Email: ${message.subject}`} />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="text" pt="sm">
          {message.text ? (
            <Code block style={{ whiteSpace: 'pre-wrap' }}>
              {message.text}
            </Code>
          ) : (
            <Text c="dimmed" size="sm">
              No text.
            </Text>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
