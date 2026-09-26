/**
 * A stand-in for the group email API, for the Email section's stories: the
 * recipient fields, who an audience reaches (recipients kept by their
 * balance), the accounts, saving, sending and testing a template, and the
 * template describe and preview. Each write is reported to `onWrite`.
 */

import type {
  AudienceRecipient,
  EmailAudience,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
} from 'api-types';
import { recipientFields } from 'components/RecipientFilterBuilder/test/recipientFields';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';
import { markdownToHtml } from 'components/templating';

import { sampleAudience, sampleBatch, sampleMessage, sampleTemplate } from './emailFixtures';

const realFetch = window.fetch.bind(window);

/** The story's campers: the fixture's two, and a few more. */
const RECIPIENTS: AudienceRecipient[] = [
  ...sampleAudience().recipients,
  ...['Ari Lin', 'Jo Diaz', 'Mo Chen', 'Rae Cruz'].map((name, i) => ({
    key: `camper:${10 + i}`,
    email: `${name.split(' ')[0].toLowerCase()}@example.com`,
    name,
    label: `${name} (camper #${10 + i})`,
    registration: 20 + i,
    camper: 10 + i,
    already_sent: false,
  })),
];

const BALANCES: Record<string, number> = { 'camper:3': 40, 'camper:4': 0, 'camper:11': 15 };

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

export function stubEmailApi(onWrite: (url: string, body: unknown) => void) {
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    if (url.includes('/email/recipient-fields')) return json(recipientFields);
    if (url.includes('/email/recipients')) {
      const audience = body as unknown as EmailAudience;
      const { skipped, diagnostics } = sampleAudience();
      return json({
        recipients: RECIPIENTS.filter((r) => reaches(audience, r)),
        skipped,
        diagnostics,
      });
    }
    if (url.includes('/api/emailaccounts/')) return json([{ id: 3, name: 'Camp Gmail' }]);
    if (url.includes('/send/')) {
      onWrite(url, body);
      return json(sampleBatch({ recipient_keys: body.recipient_keys as string[] }));
    }
    if (url.includes('/test/')) {
      onWrite(url, body);
      const recipient = RECIPIENTS.find((r) => r.key === body.recipient_key) ?? RECIPIENTS[0];
      return json({
        message: sampleMessage({ kind: 'test', to: 'you@camp.org' }),
        rendered_for: recipient,
        diagnostics: [],
      });
    }
    if (url.includes('/api/emailtemplates/')) {
      onWrite(url, body);
      return json({ ...sampleTemplate(), ...body });
    }
    if (url.includes('/templates/describe')) return json(sampleDescription);
    if (url.includes('/templates/preview')) {
      const request = JSON.parse(init?.body as string) as TemplatePreviewRequest;
      const who = RECIPIENTS.find((r) => r.camper === request.camper_id)?.name ?? 'Lee Park';
      const fill = (text = '') => text.replace(/\{\{[^}]*\}\}/g, who);
      const output = fill(request.template);
      const response: TemplatePreviewResponse = {
        output,
        subject: fill(request.subject),
        html: markdownToHtml(output),
        diagnostics: [],
        truncated: false,
        duration_ms: 9,
        sample: { kind: 'camper', id: request.camper_id ?? 3, label: who },
      };
      return json(response);
    }
    return realFetch(input, init);
  };
}
