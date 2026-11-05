/**
 * Stories for the registered apps (SPEC §8.10): some apps, and none. The last
 * action chosen is shown under the list. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiApplication } from 'api-types';
import { useState } from 'react';

import { AppsTable } from '../AppsTable';
import { SAMPLE_APPS } from './appFixtures';

function Harness({ apps }: { apps: ApiApplication[] }) {
  const [last, setLast] = useState('');
  const act = (name: string) => (app: ApiApplication) => setLast(`${name}: ${app.name}`);
  return (
    <Stack p="md" maw={760}>
      <AppsTable
        apps={apps}
        onShowSetup={act('Setup details')}
        onEdit={act('Edit')}
        onShowConnections={act('Who’s connected')}
        onNewSecret={act('New secret')}
        onDelete={act('Remove')}
      />
      {last && <Code data-testid="last">{last}</Code>}
    </Stack>
  );
}

export default { title: 'Apps Table' } satisfies Meta;

export const SomeApps: StoryFn = () => <Harness apps={SAMPLE_APPS} />;
export const NoApps: StoryFn = () => <Harness apps={[]} />;
