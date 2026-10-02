/**
 * The Markdown reference (SPEC §9.3): each construct's example beside what it
 * renders to, through the sanitizing pipeline. Given `onInsert`, an example
 * can be inserted into the editor.
 */

import { ActionIcon, Code, Divider, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { IconCornerDownLeft } from '@tabler/icons-react';
import type { TemplateContextName } from 'api-types';
import { markdownToHtml } from 'components/templating';
import { Fragment, useMemo } from 'react';

import { InlineDoc } from './InlineDoc';
import { markdownIntro, searchMarkdown } from './markdown';
import type { InsertHandler } from './TemplateReference';

interface MarkdownReferenceProps {
  context: TemplateContextName;
  query?: string;
  onInsert?: InsertHandler;
}

export function MarkdownReference({ context, query = '', onInsert }: MarkdownReferenceProps) {
  const entries = useMemo(
    () =>
      searchMarkdown(query).map((entry) => ({
        ...entry,
        html: entry.showResult ? markdownToHtml(entry.example) : undefined,
      })),
    [query],
  );

  return (
    <Stack gap="md">
      <Text size="sm">{markdownIntro(context)}</Text>
      {!entries.length && (
        <Text size="sm" c="dimmed">
          Nothing matches “{query}”.
        </Text>
      )}
      {entries.map((entry, index) => (
        <Fragment key={entry.key}>
          {index > 0 && <Divider />}
          <Stack gap="xs">
            <Group gap="xs" wrap="nowrap" justify="space-between">
              <Text fw={600} size="sm">
                {entry.title}
              </Text>
              {onInsert && (
                <Tooltip label="Insert">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label={`Insert ${entry.title}`}
                    onClick={() => onInsert(entry.example)}
                  >
                    <IconCornerDownLeft size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            <InlineDoc>{entry.doc}</InlineDoc>
            <Code block fz="xs">
              {entry.example}
            </Code>
            {entry.html !== undefined && (
              <Paper withBorder p="xs">
                {/* Safe: markdownToHtml sanitizes via rehype-sanitize (§11). */}
                <div className="md-template" dangerouslySetInnerHTML={{ __html: entry.html }} />
              </Paper>
            )}
          </Stack>
        </Fragment>
      ))}
    </Stack>
  );
}
