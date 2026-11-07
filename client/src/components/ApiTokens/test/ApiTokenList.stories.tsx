/**
 * Stories for the personal access tokens list (SPEC §6; #965): your tokens,
 * with Revoke — one made from the account, one on the server; one being
 * revoked; one without Revoke; and none. The last revoke asked for is shown
 * under the list. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { ApiTokenList } from '../ApiTokenList';
import { SAMPLE_TOKENS } from './tokens';

export default { title: 'Api Token List' } satisfies Meta;

export const YourTokens: StoryFn = () => {
  const [last, setLast] = useState('');
  return (
    <Stack p="md" maw={560}>
      <ApiTokenList
        tokens={SAMPLE_TOKENS}
        onRevoke={(token) => setLast(`Revoke: ${token.name} (${token.prefix})`)}
        emptyMessage="No tokens"
      />
      {last && <Code data-testid="last">{last}</Code>}
    </Stack>
  );
};
export const Revoking: StoryFn = () => (
  <Stack p="md" maw={560}>
    <ApiTokenList
      tokens={SAMPLE_TOKENS}
      onRevoke={() => undefined}
      revokingId={2}
      emptyMessage="No tokens"
    />
  </Stack>
);
export const WithoutRevoke: StoryFn = () => (
  <Stack p="md" maw={560}>
    <ApiTokenList tokens={SAMPLE_TOKENS} emptyMessage="No tokens" />
  </Stack>
);
export const None: StoryFn = () => (
  <Stack p="md" maw={560}>
    <ApiTokenList
      tokens={[]}
      onRevoke={() => undefined}
      emptyMessage="You haven’t made any tokens."
    />
  </Stack>
);
