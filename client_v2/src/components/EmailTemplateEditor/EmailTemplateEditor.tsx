/**
 * Edit an email template — subject and markdown body — in Jinja (SPEC §8.3,
 * §8.4, §8.9; DR-45): the template editor (§9.6) with autocomplete and help for
 * the email's variables, and a live preview of the subject and body rendered
 * for a chosen record.
 */

import { Select, Stack, Text, TextInput } from '@mantine/core';
import type { TemplateContextName } from 'api-types';
import { type PreviewSample, TemplateEditor } from 'components/TemplateEditor';
import { useState } from 'react';

export interface EmailSample {
  value: string;
  label: string;
  sample: PreviewSample;
}

interface EmailTemplateEditorProps {
  eventId: string | number;
  context: TemplateContextName;
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

  return (
    <Stack gap="sm">
      <TextInput
        label="Subject"
        description="A Jinja template too, e.g. Welcome to {{ event.name }}"
        value={subject}
        onChange={(e) => onSubjectChange(e.currentTarget.value)}
      />
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
    </Stack>
  );
}
