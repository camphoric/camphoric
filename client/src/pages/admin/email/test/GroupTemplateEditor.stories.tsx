/**
 * Stories for the group email template editor (SPEC §8.9): a new
 * template, and an existing one with conditions. The story answers the API
 * itself (stubEmailApi), so no backend is needed. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ApiEmailTemplate } from 'api-types';
import { useState } from 'react';

import { GroupTemplateEditor } from '../GroupTemplateEditor';
import { sampleTemplate } from './emailFixtures';
import { stubEmailApi } from './stubEmailApi';

function Harness({ template }: { template?: ApiEmailTemplate }) {
  const [saved, setSaved] = useState<unknown>(null);
  const [client] = useState(() => {
    stubEmailApi((_url, body) => setSaved(body));
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>
        <Stack p="md" maw={1100}>
          <GroupTemplateEditor
            eventId={7}
            organizationId={1}
            defaultFrom="registration@camp.org"
            template={template}
            helpBase="/admin/organization/1/event/7/template-help"
            onDone={() => {}}
          />
          {saved !== null && <Code block>{JSON.stringify(saved, null, 2)}</Code>}
        </Stack>
      </ModalsProvider>
    </QueryClientProvider>
  );
}

export default { title: 'Group Template Editor' } satisfies Meta;

export const New: StoryFn = () => <Harness />;

export const WithConditions: StoryFn = () => (
  <Harness
    template={sampleTemplate({
      recipient_source: 'campers',
      body: '# Hi {{ recipient.name }}\n\nYou still owe {{ registration.balance | money }}.',
    })}
  />
);
