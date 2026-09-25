/**
 * The variables reference (SPEC §9.3): a kind of template's variables and
 * every type they lead to, each field with its type, description and
 * example, from the server's variable spec. Types link to their own section.
 * Given `onInsert`, each entry can be inserted into the editor.
 */

import {
  ActionIcon,
  Anchor,
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
import type { TemplateContextName, TemplateDescription, TemplateFieldDescription } from 'api-types';
import { Fragment, useId } from 'react';

import { InlineDoc } from './InlineDoc';
import { isEventType, referencedType, variableSections } from './reference';

export type InsertHandler = (text: string, options?: { snippet?: boolean }) => void;

interface TemplateReferenceProps {
  description: TemplateDescription;
  context: TemplateContextName;
  query?: string;
  onInsert?: InsertHandler;
}

function anchorId(prefix: string, type: string) {
  return `${prefix}-${type.replace(/[^\w-]/g, '_')}`;
}

function TypeLabel({
  description,
  type,
  prefix,
}: {
  description: TemplateDescription;
  type: string;
  prefix: string;
}) {
  const target = referencedType(description, type);
  if (!target) return <Code>{type}</Code>;
  return (
    <Anchor
      component="button"
      type="button"
      size="sm"
      onClick={() =>
        document.getElementById(anchorId(prefix, target))?.scrollIntoView({ block: 'start' })
      }
    >
      <Code>{type}</Code>
    </Anchor>
  );
}

/** What inserting a field adds: a variable's name, or `.field` / `['key']`. */
function insertText(field: TemplateFieldDescription, isVariable: boolean) {
  const call = field.callable ? '()' : '';
  if (isVariable) return `${field.name}${call}`;
  return field.identifier === false ? `['${field.name}']` : `.${field.name}${call}`;
}

export function FieldEntry({
  description,
  field,
  prefix,
  isVariable,
  onInsert,
}: {
  description: TemplateDescription;
  field: TemplateFieldDescription;
  prefix: string;
  isVariable: boolean;
  onInsert?: InsertHandler;
}) {
  return (
    <Stack gap={2}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Group gap="xs">
          <Text fw={600} ff="monospace" size="sm">
            {field.callable ? (field.signature ?? `${field.name}()`) : field.name}
          </Text>
          <TypeLabel description={description} type={field.type} prefix={prefix} />
          {field.nullable && (
            <Badge size="xs" variant="light" color="gray">
              may be empty
            </Badge>
          )}
        </Group>
        {onInsert && (
          <Tooltip label={`Insert ${insertText(field, isVariable)}`}>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={`Insert ${field.name}`}
              onClick={() => onInsert(insertText(field, isVariable))}
            >
              <IconCornerDownLeft size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {field.title && field.title !== field.doc && (
        <Text size="sm" fw={500}>
          {field.title}
        </Text>
      )}
      <InlineDoc>{field.doc}</InlineDoc>
      {field.enum?.length ? (
        <Text size="sm" c="dimmed">
          One of: {field.enum.map((value) => String(value)).join(', ')}
        </Text>
      ) : null}
      {field.example && (
        <Code block fz="xs">
          {field.example}
        </Code>
      )}
    </Stack>
  );
}

export function TemplateReference({
  description,
  context,
  query = '',
  onInsert,
}: TemplateReferenceProps) {
  const prefix = `tpl-ref-${useId().replace(/\W/g, '')}`;
  const sections = variableSections(description, context, query);

  if (!sections.length) {
    return (
      <Text size="sm" c="dimmed">
        Nothing matches “{query}”.
      </Text>
    );
  }

  return (
    <Stack gap="xl">
      {sections.map((section) => (
        <Stack
          key={section.id}
          gap="sm"
          id={anchorId(prefix, section.id)}
          style={{ scrollMarginTop: 8 }}
        >
          <Stack gap={2}>
            <Group gap="xs">
              <Title order={4} ff={section.id === 'variables' ? undefined : 'monospace'}>
                {section.title}
              </Title>
              {isEventType(section.id) && (
                <Badge size="sm" variant="light">
                  this event
                </Badge>
              )}
            </Group>
            {section.doc && <InlineDoc>{section.doc}</InlineDoc>}
          </Stack>
          {section.fields.length ? (
            section.fields.map((field, index) => (
              <Fragment key={field.name}>
                {index > 0 && <Divider />}
                <FieldEntry
                  description={description}
                  field={field}
                  prefix={prefix}
                  isVariable={section.id === 'variables'}
                  onInsert={onInsert}
                />
              </Fragment>
            ))
          ) : (
            <Text size="sm" c="dimmed">
              No fields.
            </Text>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
