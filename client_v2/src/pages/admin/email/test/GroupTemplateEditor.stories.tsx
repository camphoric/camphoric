/**
 * Ladle stories for the group email template editor (SPEC §8.9): a new
 * template, and an existing one with conditions. The story answers the API
 * itself — the recipient fields, who the audience reaches (a stand-in that
 * keeps recipients by their camper's balance), the accounts, and the template
 * describe and preview — so no backend is needed. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Code, Stack } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  ApiEmailTemplate,
  AudienceRecipient,
  EmailAudience,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
} from 'api-types';
import { recipientFields } from 'components/RecipientFilterBuilder/test/recipientFields';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';
import { markdownToHtml } from 'components/templating';
import { useState } from 'react';

import { GroupTemplateEditor } from '../GroupTemplateEditor';
import { sampleAudience, sampleTemplate } from './emailFixtures';

const realFetch = window.fetch.bind(window);

const BALANCES: Record<string, number> = { 'camper:3': 40, 'camper:4': 0 };

/** Keep a recipient when every (or any) balance condition holds; ignore other fields. */
function reaches(audience: EmailAudience, recipient: AudienceRecipient) {
  const rules = (audience.filter.rules ?? []).filter((r) => r.field === 'registration.balance');
  if (!rules.length) return true;
  const test = (op: string, value: number) => {
    const balance = BALANCES[recipient.key] ?? 0;
    return { gt: balance > value, lt: balance < value, eq: balance === value }[op] ?? true;
  };
  const results = rules.map((r) => test(r.op, Number(r.value)));
  return audience.filter.combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function stubApi(onSave: (template: unknown) => void) {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    if (url.includes('/email/recipient-fields')) return json(recipientFields);
    if (url.includes('/email/recipients')) {
      const audience = body as unknown as EmailAudience;
      const all = sampleAudience();
      return json({ ...all, recipients: all.recipients.filter((r) => reaches(audience, r)) });
    }
    if (url.includes('/api/emailaccounts/')) return json([{ id: 3, name: 'Camp Gmail' }]);
    if (url.includes('/api/emailtemplates/')) {
      onSave(body);
      return json({ ...sampleTemplate(), ...body });
    }
    if (url.includes('/templates/describe')) return json(sampleDescription);
    if (url.includes('/templates/preview')) {
      const request = JSON.parse(init?.body as string) as TemplatePreviewRequest;
      const who = request.camper_id === 4 ? 'Sam' : 'Lee';
      const fill = (text = '') => text.replace(/\{\{[^}]*\}\}/g, who);
      const output = fill(request.template);
      const response: TemplatePreviewResponse = {
        output,
        subject: fill(request.subject),
        html: markdownToHtml(output),
        diagnostics: [],
        truncated: false,
        duration_ms: 9,
        sample: { kind: 'camper', id: request.camper_id ?? 3, label: `${who} Park` },
      };
      return json(response);
    }
    return realFetch(input, init);
  };
}

function Harness({ template }: { template?: ApiEmailTemplate }) {
  const [saved, setSaved] = useState<unknown>(null);
  const [client] = useState(() => {
    stubApi(setSaved);
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

export const New: Story = () => <Harness />;

export const WithConditions: Story = () => (
  <Harness
    template={sampleTemplate({
      recipient_source: 'campers',
      body: '# Hi {{ recipient.name }}\n\nYou still owe {{ registration.balance | money }}.',
    })}
  />
);
