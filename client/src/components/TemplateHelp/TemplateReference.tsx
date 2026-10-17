/**
 * The variables reference (SPEC §9.3): a kind of template's variables and
 * every type they lead to — then the Python value types, with their methods —
 * each field with its type, description and example, from the server's
 * variable spec. Types link to their own section.
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
import { elementType } from 'components/TemplateEditor/completion';
import { Fragment, useId } from 'react';

import { InlineDoc } from './InlineDoc';
import { isEventType, variableSections } from './reference';

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

/**
 * A section's header — title, doc and base — set apart from the fields below
 * it: a tinted band with an accent bar, its title in the accent colour.
 */
const SECTION_HEADER_STYLE = {
  background: 'var(--mantine-primary-color-light)',
  borderLeft: '4px solid var(--mantine-primary-color-filled)',
  borderRadius: 'var(--mantine-radius-sm)',
};

/** Space left above a section's heading when a link scrolls to it. */
const SECTION_GAP = 8;

/** The nearest ancestor that scrolls, or the page. */
function scrollParent(element: HTMLElement): Element {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (/auto|scroll/.test(overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return document.scrollingElement ?? document.documentElement;
}

/**
 * Scroll a section to the top of what can be seen: below a fixed header (the
 * admin frame's) or a sticky one (the help drawer's), which would otherwise
 * cover its heading.
 */
function scrollToSection(section: HTMLElement) {
  section.scrollIntoView({ block: 'start' });
  const { left, top } = section.getBoundingClientRect();
  const coveredTo = Math.max(
    0,
    ...document
      .elementsFromPoint(left + 1, Math.max(top, 0) + 1)
      .filter((element) => !element.contains(section))
      .filter((element) => ['fixed', 'sticky'].includes(getComputedStyle(element).position))
      .map((element) => element.getBoundingClientRect().bottom),
  );
  const hidden = coveredTo + SECTION_GAP - top;
  if (hidden > 0) scrollParent(section).scrollBy({ top: -hidden });
}

/** A type's name, a link to its section when it has one. */
function TypeName({
  description,
  type,
  prefix,
}: {
  description: TemplateDescription;
  type: string;
  prefix: string;
}) {
  if (!description.types[type]) return type;
  return (
    <Anchor
      component="button"
      type="button"
      inherit
      onClick={() => {
        const section = document.getElementById(anchorId(prefix, type));
        if (section) scrollToSection(section);
      }}
    >
      {type}
    </Anchor>
  );
}

/** A field's type; in `list<camper>`, `list` and `camper` each link to their own section. */
function TypeParts({
  description,
  type,
  prefix,
}: {
  description: TemplateDescription;
  type: string;
  prefix: string;
}) {
  const element = elementType(type);
  if (element === undefined)
    return <TypeName description={description} type={type} prefix={prefix} />;
  return (
    <>
      <TypeName description={description} type="list" prefix={prefix} />
      {'<'}
      <TypeParts description={description} type={element} prefix={prefix} />
      {'>'}
    </>
  );
}

function TypeLabel(props: { description: TemplateDescription; type: string; prefix: string }) {
  return (
    <Code>
      <TypeParts {...props} />
    </Code>
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
          style={{ scrollMarginTop: SECTION_GAP }}
        >
          <Stack gap={2} px="sm" py="xs" style={SECTION_HEADER_STYLE}>
            <Group gap="xs">
              <Title
                order={3}
                c="var(--mantine-primary-color-light-color)"
                ff={section.id === 'variables' ? undefined : 'monospace'}
              >
                {section.title}
              </Title>
              {isEventType(section.id) && (
                <Badge size="sm" variant="outline">
                  this event
                </Badge>
              )}
            </Group>
            {/* Full-strength text: dimmed grey is too faint on the band. */}
            {section.doc && <InlineDoc c="var(--mantine-color-text)">{section.doc}</InlineDoc>}
            {section.base && (
              <Text size="sm">
                Also has the methods of{' '}
                <TypeLabel description={description} type={section.base} prefix={prefix} />.
              </Text>
            )}
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
