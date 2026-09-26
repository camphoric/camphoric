/**
 * Ladle stories for the email template editor (SPEC §8.3, §8.4). The story
 * answers the describe and preview requests itself (a real variable spec, and
 * a stand-in render that echoes the subject and body), so no backend is
 * needed. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Stack } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TemplateEngine, TemplatePreviewRequest, TemplatePreviewResponse } from 'api-types';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';
import { markdownToHtml } from 'components/templating';
import { type ReactNode, useState } from 'react';

import { EmailTemplateEditor } from '../EmailTemplateEditor';

const realFetch = window.fetch.bind(window);

/** Answer the template endpoints; everything else goes to the network. */
function stubTemplateApi() {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/templates/describe')) return json(sampleDescription);
    if (url.includes('/templates/preview')) {
      const request = JSON.parse(init?.body as string) as TemplatePreviewRequest;
      const who = request.invitation_id === 2 ? 'Sam' : 'Lee';
      const fill = (text = '') => text.replace(/\{\{[^}]*\}\}/g, who);
      const output = fill(request.template);
      const response: TemplatePreviewResponse = {
        output,
        subject: fill(request.subject),
        html: markdownToHtml(output),
        diagnostics: [],
        truncated: false,
        duration_ms: 9,
        sample: {
          kind: 'invitation',
          id: request.invitation_id ?? 1,
          label: `Invitation to ${who}`,
        },
      };
      return json(response);
    }
    return realFetch(input, init);
  };
}

function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    stubTemplateApi();
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  return (
    <QueryClientProvider client={client}>
      <ModalsProvider>{children}</ModalsProvider>
    </QueryClientProvider>
  );
}

function Editor({
  initialEngine,
  initialBody,
}: {
  initialEngine: TemplateEngine;
  initialBody: string;
}) {
  const [engine, setEngine] = useState(initialEngine);
  const [subject, setSubject] = useState('Your invitation to {{ event.name }}');
  const [body, setBody] = useState(initialBody);
  return (
    <Providers>
      <Stack p="md">
        <EmailTemplateEditor
          eventId={4}
          context="invitation_email"
          engine={engine}
          onEngineChange={setEngine}
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          samples={[
            { value: '1', label: 'Lee <lee@example.com>', sample: { invitation_id: 1 } },
            { value: '2', label: 'Sam <sam@example.com>', sample: { invitation_id: 2 } },
          ]}
          helpHref="/admin/organization/1/event/4/template-help?context=invitation_email"
        />
      </Stack>
    </Providers>
  );
}

export const Jinja: Story = () => (
  <Editor
    initialEngine="jinja"
    initialBody={
      '# Hi {{ invitation.recipient_name }}\n\nRegister here: {{ invitation.register_url }}'
    }
  />
);

export const Mustache: Story = () => (
  <Editor
    initialEngine="mustache"
    initialBody={'Hi {{recipient_name}}, here is your link: {{{register_link}}}'}
  />
);

export const Empty: Story = () => <Editor initialEngine="jinja" initialBody="" />;
