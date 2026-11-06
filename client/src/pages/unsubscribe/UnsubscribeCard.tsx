/**
 * What the unsubscribe page shows (SPEC §8.9; §15 DR-48, DR-154): asking to
 * confirm unsubscribing an address from an event's group email, that it's
 * done, or why the link can't be used.
 */

import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import type { ApiUnsubscribeLink } from 'api-types';
import type { ReactNode } from 'react';

export type UnsubscribeCardProps =
  | {
      state: 'ask';
      link: ApiUnsubscribeLink;
      onConfirm: () => void;
      confirming?: boolean;
      /** Confirming failed: why, to try again. */
      error?: string | null;
    }
  | { state: 'done'; link: ApiUnsubscribeLink }
  | { state: 'problem'; detail: string }
  | { state: 'unreachable'; detail: string; onRetry: () => void; retrying?: boolean };

/** An address or event name, which may be long enough to need wrapping on a phone. */
function Strong({ children }: { children: ReactNode }) {
  return (
    <Text span fw={600} c="var(--mantine-color-text)" style={{ overflowWrap: 'anywhere' }}>
      {children}
    </Text>
  );
}

const STILL_GET = 'You’ll still get emails about your own registration, such as its confirmation.';

export function UnsubscribeCard(props: UnsubscribeCardProps) {
  switch (props.state) {
    case 'problem':
      return (
        <Stack>
          <Title order={3}>This link doesn’t work</Title>
          <Text c="dimmed">{props.detail}</Text>
        </Stack>
      );
    case 'unreachable':
      return (
        <Stack>
          <Title order={3}>The link couldn’t be checked</Title>
          <Text c="dimmed">{props.detail}</Text>
          <Group>
            <Button onClick={props.onRetry} loading={props.retrying}>
              Try again
            </Button>
          </Group>
        </Stack>
      );
    case 'done':
      return (
        <Stack>
          <Title order={3}>You’re unsubscribed</Title>
          <Text c="dimmed">
            <Strong>{props.link.address}</Strong> won’t get any more group emails about{' '}
            <Strong>{props.link.event.name}</Strong>.
          </Text>
          <Text c="dimmed">{STILL_GET}</Text>
        </Stack>
      );
    case 'ask':
      return (
        <Stack>
          <Title order={3}>Unsubscribe?</Title>
          <Text c="dimmed">
            Stop sending group emails about <Strong>{props.link.event.name}</Strong> to{' '}
            <Strong>{props.link.address}</Strong>?
          </Text>
          <Text c="dimmed">{STILL_GET}</Text>
          {props.error && (
            <Alert color="red" variant="light">
              {props.error}
            </Alert>
          )}
          <Group>
            <Button onClick={props.onConfirm} loading={props.confirming}>
              Unsubscribe
            </Button>
          </Group>
        </Stack>
      );
  }
}
