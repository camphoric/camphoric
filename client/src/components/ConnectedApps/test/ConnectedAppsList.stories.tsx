/**
 * Stories for the connected-apps list (SPEC §6, §8.10): a person's apps, with
 * Disconnect; an app's users, as an Admin sees them; one being disconnected;
 * and none. The last disconnect asked for is shown under the list. Run
 * `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { ConnectedAppsList } from '../ConnectedAppsList';
import { SAMPLE_CONNECTIONS } from './connections';

function Harness({ show }: { show: 'application' | 'user' }) {
  const [last, setLast] = useState('');
  return (
    <Stack p="md" maw={560}>
      <ConnectedAppsList
        connections={SAMPLE_CONNECTIONS}
        show={show}
        onDisconnect={(connection) =>
          setLast(`Disconnect: ${connection.application.name} for ${connection.user.username}`)
        }
        emptyMessage="No apps"
      />
      {last && <Code data-testid="last">{last}</Code>}
    </Stack>
  );
}

export default { title: 'Connected Apps List' } satisfies Meta;

export const YourApps: StoryFn = () => <Harness show="application" />;
export const AnAppsUsers: StoryFn = () => <Harness show="user" />;
export const Disconnecting: StoryFn = () => (
  <Stack p="md" maw={560}>
    <ConnectedAppsList
      connections={SAMPLE_CONNECTIONS}
      show="application"
      onDisconnect={() => undefined}
      disconnectingId={1}
      emptyMessage="No apps"
    />
  </Stack>
);
export const ReadOnly: StoryFn = () => (
  <Stack p="md" maw={560}>
    <ConnectedAppsList connections={SAMPLE_CONNECTIONS} show="user" emptyMessage="No apps" />
  </Stack>
);
export const None: StoryFn = () => (
  <Stack p="md" maw={560}>
    <ConnectedAppsList
      connections={[]}
      show="application"
      onDisconnect={() => undefined}
      emptyMessage="You haven’t connected any apps to your account."
    />
  </Stack>
);
