/**
 * Stories for choosing the events in multi-event reports and their series
 * (SPEC §8.12): as a Registrar, who changes them (kept in the story), and as a
 * Reporter, who only sees them. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiMultiEventEvent, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { EventInclusionList } from '../EventInclusionList';
import { EVENTS } from './fixtures';

function Frame({ userRole = 'registrar' }: { userRole?: Role }) {
  const [events, setEvents] = useState<ApiMultiEventEvent[]>(EVENTS);
  return (
    <PermissionsProvider userRole={userRole}>
      <Paper withBorder p="md" m="md" maw={640}>
        <EventInclusionList
          events={events}
          onChange={(id, change) =>
            setEvents((prev) => prev.map((e) => (e.event === id ? { ...e, ...change } : e)))
          }
        />
      </Paper>
    </PermissionsProvider>
  );
}

export default { title: 'Event Inclusion List' } satisfies Meta;

export const Registrar: StoryFn = () => <Frame />;
export const Reporter: StoryFn = () => <Frame userRole="reporter" />;
