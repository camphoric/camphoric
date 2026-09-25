/**
 * Template Help guides (SPEC §9.3): pick a topic, read it. The markdown goes
 * through the sanitizing pipeline.
 */

import { Select, Stack } from '@mantine/core';
import { markdownToHtml } from 'components/templating';
import { useMemo } from 'react';

import { GUIDE_TOPICS, guideTopic } from './guides';

interface TemplateGuideProps {
  topic: string;
  onTopicChange: (topic: string) => void;
}

export function TemplateGuide({ topic, onTopicChange }: TemplateGuideProps) {
  const current = guideTopic(topic);
  const html = useMemo(() => markdownToHtml(`# ${current.title}\n${current.body}`), [current]);

  return (
    <Stack gap="md">
      <Select
        label="Topic"
        data={GUIDE_TOPICS.map((t) => ({ value: t.id, label: t.title }))}
        value={current.id}
        onChange={(value) => value && onTopicChange(value)}
        allowDeselect={false}
      />
      {/* Safe: markdownToHtml sanitizes via rehype-sanitize (§11). */}
      <div className="md-template" dangerouslySetInnerHTML={{ __html: html }} />
    </Stack>
  );
}
