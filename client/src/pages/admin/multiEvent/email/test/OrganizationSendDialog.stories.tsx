/**
 * Stories for sending an organization's email to past campers (SPEC §8.12):
 * review the people it reaches, see who's left out, pick the sender and when,
 * send a test, and confirm — as a Registrar, and as a Reporter who can only
 * look. The story answers the API itself (stubEmailApi) and shows what it
 * would have posted. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { stubEmailApi } from '../../../email/test/stubEmailApi';
import { OrganizationSendDialog } from '../OrganizationSendDialog';
import { sampleOrganizationEmail } from './fixtures';

function Harness({ userRole }: { userRole: Role }) {
  const [posted, setPosted] = useState<{ url: string; body: unknown } | null>(null);
  const [client] = useState(() => {
    stubEmailApi((url, body) => setPosted({ url, body }));
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <PermissionsProvider userRole={userRole}>
        <ModalsProvider>
          <Stack p="md" maw={1100}>
            <OrganizationSendDialog
              email={sampleOrganizationEmail()}
              onClose={() => {}}
              onSent={() => {}}
            />
            {posted && (
              <Code block data-testid="posted">
                {posted.url} {JSON.stringify(posted.body, null, 2)}
              </Code>
            )}
          </Stack>
        </ModalsProvider>
      </PermissionsProvider>
    </QueryClientProvider>
  );
}

export default { title: 'Organization Send Dialog' } satisfies Meta;

export const Registrar: StoryFn = () => <Harness userRole="registrar" />;
export const Reporter: StoryFn = () => <Harness userRole="reporter" />;
