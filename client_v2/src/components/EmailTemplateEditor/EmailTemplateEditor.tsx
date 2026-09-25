/**
 * Edit an email template — subject and markdown body — in either engine
 * (SPEC §8.3, §8.4; DR-38):
 *
 * - **Jinja**: the template editor (§9.6) with autocomplete and help for the
 *   email's variables, and a live preview of the subject and body rendered for
 *   a chosen registration or invitation.
 * - **Mustache** (legacy): a plain editor; the help's "From Mustache emails"
 *   guide maps its variables to Jinja.
 *
 * Switching engines doesn't convert the text; when there is text, it asks
 * first.
 */

import { Anchor, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { TemplateContextName, TemplateEngine } from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import { type PreviewSample, TemplateEditor } from 'components/TemplateEditor';
import { useState } from 'react';

export interface EmailSample {
  value: string;
  label: string;
  sample: PreviewSample;
}

const ENGINE_OPTIONS: { value: TemplateEngine; label: string }[] = [
  { value: 'jinja', label: 'Jinja' },
  { value: 'mustache', label: 'Mustache (legacy)' },
];

interface EmailTemplateEditorProps {
  eventId: string | number;
  context: TemplateContextName;
  engine: TemplateEngine;
  onEngineChange: (engine: TemplateEngine) => void;
  subject: string;
  onSubjectChange: (subject: string) => void;
  body: string;
  onBodyChange: (body: string) => void;
  /** Records a Jinja preview can render for; without a choice, the first is used. */
  samples?: EmailSample[];
  /** Added to every preview request (e.g. the invitation's registration type). */
  baseSample?: PreviewSample;
  /** The Template Help page for this kind of email. */
  helpHref?: string;
}

export function EmailTemplateEditor({
  eventId,
  context,
  engine,
  onEngineChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  samples = [],
  baseSample,
  helpHref,
}: EmailTemplateEditorProps) {
  const [sampleValue, setSampleValue] = useState<string | null>(null);
  const chosen = samples.find((s) => s.value === sampleValue) ?? samples[0];
  const isJinja = engine === 'jinja';

  const changeEngine = (next: TemplateEngine) => {
    if (next === engine) return;
    if (!body.trim() && !subject.trim()) {
      onEngineChange(next);
      return;
    }
    modals.openConfirmModal({
      title: next === 'jinja' ? 'Switch this email to Jinja?' : 'Switch this email to Mustache?',
      children: (
        <Text size="sm">
          The subject and body aren’t converted — rewrite them in{' '}
          {next === 'jinja' ? 'Jinja' : 'Mustache'} before saving
          {next === 'jinja'
            ? ' (Template help’s “From Mustache emails” guide maps the variables)'
            : ''}
          .
        </Text>
      ),
      labels: { confirm: 'Switch', cancel: 'Cancel' },
      onConfirm: () => onEngineChange(next),
    });
  };

  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Template language
        </Text>
        <SegmentedControl
          data={ENGINE_OPTIONS}
          value={engine}
          onChange={(value) => changeEngine(value as TemplateEngine)}
          aria-label="Template language"
          w="fit-content"
        />
      </Stack>
      <TextInput
        label="Subject"
        description={isJinja ? 'A Jinja template too, e.g. Welcome to {{ event.name }}' : undefined}
        value={subject}
        onChange={(e) => onSubjectChange(e.currentTarget.value)}
      />
      {isJinja ? (
        <>
          {samples.length > 1 && (
            <Select
              label="Preview for"
              data={samples.map(({ value, label }) => ({ value, label }))}
              value={chosen?.value ?? null}
              onChange={setSampleValue}
              searchable
              allowDeselect={false}
              w={420}
            />
          )}
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Body (markdown)
            </Text>
            <TemplateEditor
              value={body}
              onChange={onBodyChange}
              eventId={eventId}
              context={context}
              output="email"
              subject={subject}
              sample={{ ...baseSample, ...chosen?.sample }}
              helpHref={helpHref}
            />
          </Stack>
        </>
      ) : (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Body (markdown)
          </Text>
          <JsonEditor value={body} onChange={onBodyChange} language="handlebars" height={280} />
          {helpHref && (
            <Text size="sm" c="dimmed">
              Moving this email to Jinja?{' '}
              <Anchor href={`${helpHref}&helpTab=guide&topic=mustache`} target="_blank" size="sm">
                See how its variables map
              </Anchor>
              .
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}
