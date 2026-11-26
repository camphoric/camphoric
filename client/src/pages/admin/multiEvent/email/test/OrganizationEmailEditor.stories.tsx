/**
 * Stories for writing an organization's email to past campers (SPEC §8.12):
 * a new email, and one being edited — its rules, the count they reach, the
 * sender, and the subject and body with a preview for one person — and a
 * Reporter's read-only view. The story answers the API itself (stubEmailApi)
 * and shows what it would have saved. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiOrganizationEmail, Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { useState } from 'react';

import { stubEmailApi } from '../../../email/test/stubEmailApi';
import { OrganizationEmailEditor } from '../OrganizationEmailEditor';
import { sampleOrganizationEmail } from './fixtures';

function Harness({
  email,
  userRole = 'registrar',
}: {
  email?: ApiOrganizationEmail;
  userRole?: Role;
}) {
  const [saved, setSaved] = useState<{ url: string; body: unknown } | null>(null);
  const [client] = useState(() => {
    stubEmailApi((url, body) => setSaved({ url, body }));
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <PermissionsProvider userRole={userRole}>
        <ModalsProvider>
          <Stack p="md" maw={1100}>
            <OrganizationEmailEditor organizationId="1" email={email} onDone={() => {}} />
            {saved && (
              <Code block data-testid="saved">
                {saved.url} {JSON.stringify(saved.body, null, 2)}
              </Code>
            )}
          </Stack>
        </ModalsProvider>
      </PermissionsProvider>
    </QueryClientProvider>
  );
}

export default { title: 'Organization Email Editor' } satisfies Meta;

export const New: StoryFn = () => <Harness />;
export const Editing: StoryFn = () => (
  <Harness
    email={sampleOrganizationEmail({
      filter: {
        combinator: 'and',
        rules: [{ field: 'registration.balance', op: 'gt', value: 0 }],
      },
    })}
  />
);
export const Reporter: StoryFn = () => (
  <Harness email={sampleOrganizationEmail()} userRole="reporter" />
);
