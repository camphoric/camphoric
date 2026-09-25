/**
 * Filters, tests and tags (SPEC §9.3), from the server's variable spec:
 * Camphoric's own filters first, then Jinja's. Given `onInsert`, each can be
 * inserted into the editor (tags as snippets).
 */

import {
  ActionIcon,
  Badge,
  Code,
  Divider,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconCornerDownLeft } from '@tabler/icons-react';
import type { TemplateDescription } from 'api-types';
import { Fragment } from 'react';

import { InlineDoc } from './InlineDoc';
import { searchFilters, searchTags, searchTests } from './reference';
import type { InsertHandler } from './TemplateReference';

interface Entry {
  key: string;
  heading: string;
  badge?: string;
  doc: string;
  example?: string;
  insert: string;
  snippet?: boolean;
}

function EntryList({
  title,
  entries,
  onInsert,
}: {
  title: string;
  entries: Entry[];
  onInsert?: InsertHandler;
}) {
  if (!entries.length) return null;
  return (
    <Stack gap="sm">
      <Title order={4}>{title}</Title>
      {entries.map((entry, index) => (
        <Fragment key={entry.key}>
          {index > 0 && <Divider />}
          <Stack gap={2}>
            <Group gap="xs" wrap="nowrap" justify="space-between">
              <Group gap="xs">
                <Text fw={600} ff="monospace" size="sm">
                  {entry.heading}
                </Text>
                {entry.badge && (
                  <Badge size="xs" variant="light">
                    {entry.badge}
                  </Badge>
                )}
              </Group>
              {onInsert && (
                <Tooltip label="Insert">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    aria-label={`Insert ${entry.key}`}
                    onClick={() => onInsert(entry.insert, { snippet: entry.snippet })}
                  >
                    <IconCornerDownLeft size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            <InlineDoc>{entry.doc}</InlineDoc>
            {entry.example && (
              <Code block fz="xs">
                {entry.example}
              </Code>
            )}
          </Stack>
        </Fragment>
      ))}
    </Stack>
  );
}

interface TemplateSyntaxReferenceProps {
  description: TemplateDescription;
  query?: string;
  onInsert?: InsertHandler;
}

export function TemplateSyntaxReference({
  description,
  query = '',
  onInsert,
}: TemplateSyntaxReferenceProps) {
  const filters = searchFilters(description, query).sort(
    (a, b) => Number(a.builtin) - Number(b.builtin),
  );
  const tests = searchTests(description, query);
  const tags = searchTags(description, query);

  if (!filters.length && !tests.length && !tags.length) {
    return (
      <Text size="sm" c="dimmed">
        Nothing matches “{query}”.
      </Text>
    );
  }

  return (
    <Stack gap="xl">
      <EntryList
        title="Filters"
        onInsert={onInsert}
        entries={filters.map((f) => ({
          key: `filter ${f.name}`,
          heading: f.signature,
          badge: f.builtin ? undefined : 'Camphoric',
          doc: f.doc,
          example: f.example,
          insert: ` | ${f.name}`,
        }))}
      />
      <EntryList
        title="Tests"
        onInsert={onInsert}
        entries={tests.map((t) => ({
          key: `test ${t.name}`,
          heading: t.name,
          doc: t.doc,
          example: t.example,
          insert: ` is ${t.name}`,
        }))}
      />
      <EntryList
        title="Tags"
        onInsert={onInsert}
        entries={tags.map((t) => ({
          key: `tag ${t.name}`,
          heading: t.name,
          doc: t.doc,
          example: t.snippet.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\d+/g, ''),
          insert: t.snippet,
          snippet: true,
        }))}
      />
    </Stack>
  );
}
