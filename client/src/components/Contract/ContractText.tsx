/**
 * A contract version's text (SPEC §6; §15 DR-145): each section in order, its
 * title and its Markdown, rendered through the sanitizing pipeline (§9.3).
 */

import { Stack, Title } from '@mantine/core';
import type { ApiContractSection } from 'api-types';
import { markdownToHtml, RenderedMarkdown } from 'components/templating';
import { useMemo } from 'react';

interface ContractTextProps {
  sections: ApiContractSection[];
}

export function ContractText({ sections }: ContractTextProps) {
  return (
    <Stack gap="lg">
      {sections.map((section, index) => (
        <ContractSectionText key={index} section={section} />
      ))}
    </Stack>
  );
}

function ContractSectionText({ section }: { section: ApiContractSection }) {
  const html = useMemo(() => markdownToHtml(section.body), [section.body]);
  return (
    <section aria-label={section.title}>
      <Title order={4} mb="xs">
        {section.title}
      </Title>
      <RenderedMarkdown html={html} />
    </section>
  );
}

/** When a version took effect, as a date. */
export function formatEffectiveDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
