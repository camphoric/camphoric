/**
 * Stories for the suggested matches (SPEC §8.12; §15 DR-178): linking one or
 * saying they aren't the same person takes it off the list (kept in the
 * story); a Reporter only sees them. Run `npm run storybook`.
 */

import { Box } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiPersonSuggestion, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { SuggestionList } from '../SuggestionList';
import { EVENTS_BY_ID, RECORDS_BY_ID, SUGGESTIONS } from './fixtures';

function Frame({
  userRole = 'registrar',
  suggestions = SUGGESTIONS,
}: {
  userRole?: Role;
  suggestions?: ApiPersonSuggestion[];
}) {
  const [shown, setShown] = useState(suggestions);
  const remove = (s: ApiPersonSuggestion) => setShown((prev) => prev.filter((x) => x !== s));
  return (
    <PermissionsProvider userRole={userRole}>
      <Box p="md" maw={860}>
        <SuggestionList
          suggestions={shown}
          records={RECORDS_BY_ID}
          events={EVENTS_BY_ID}
          onLink={remove}
          onDismiss={remove}
          onOpenCamper={() => undefined}
        />
      </Box>
    </PermissionsProvider>
  );
}

export default { title: 'Suggestion List' } satisfies Meta;

export const Registrar: StoryFn = () => <Frame />;
export const Reporter: StoryFn = () => <Frame userRole="reporter" />;
export const None: StoryFn = () => <Frame suggestions={[]} />;
