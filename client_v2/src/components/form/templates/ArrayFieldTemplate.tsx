/**
 * An array field laid out like an object section (SPEC §9.1; §15 DR-49): its
 * title as a section heading, its description, the items, then an add button
 * that says what it adds — `ui:options.addButtonText`, else "Add <item
 * title>". The base theme draws arrays as a bordered, filled fieldset with the
 * title on its border instead, unlike every other section, and its add button
 * is an unlabelled "+".
 */

import { Box, Button, Group, Stack } from '@mantine/core';
import {
  type ArrayFieldTemplateProps,
  buttonId,
  getTemplate,
  getUiOptions,
  titleId,
} from '@rjsf/utils';
import { IconPlus } from '@tabler/icons-react';

/** The add button's text: the uiSchema's, else "Add" and the item's title. */
export function addButtonText(props: Pick<ArrayFieldTemplateProps, 'schema' | 'uiSchema'>) {
  const text: unknown = getUiOptions(props.uiSchema).addButtonText;
  if (typeof text === 'string' && text.trim()) return text;
  const items = props.schema.items;
  const itemTitle =
    items && typeof items === 'object' && !Array.isArray(items) ? items.title : undefined;
  return `Add ${itemTitle || 'item'}`;
}

export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const {
    canAdd,
    className,
    disabled,
    fieldPathId,
    items,
    optionalDataControl,
    onAddClick,
    readonly,
    required,
    schema,
    uiSchema,
    title,
    registry,
  } = props;
  const uiOptions = getUiOptions(uiSchema);
  const TitleFieldTemplate = getTemplate('TitleFieldTemplate', registry, uiOptions);
  const ArrayFieldDescriptionTemplate = getTemplate(
    'ArrayFieldDescriptionTemplate',
    registry,
    uiOptions,
  );
  const heading = uiOptions.title || title;
  const description = uiOptions.description || schema.description;
  const showOptionalDataControlInTitle = !readonly && !disabled;

  return (
    <Box id={fieldPathId.$id} className={className}>
      {heading && uiOptions.label !== false && (
        <TitleFieldTemplate
          id={titleId(fieldPathId)}
          title={heading}
          required={required}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
          optionalDataControl={showOptionalDataControlInTitle ? optionalDataControl : undefined}
        />
      )}
      {description && (
        <ArrayFieldDescriptionTemplate
          description={description}
          fieldPathId={fieldPathId}
          schema={schema}
          uiSchema={uiSchema}
          registry={registry}
        />
      )}
      <Stack gap="xs" className="rjsf-array-item-list">
        {!showOptionalDataControlInTitle ? optionalDataControl : undefined}
        {items}
      </Stack>
      {canAdd && (
        <Group mt="xs">
          <Button
            id={buttonId(fieldPathId, 'add')}
            className="rjsf-array-item-add"
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => onAddClick()}
            disabled={disabled || readonly}
          >
            {addButtonText({ schema, uiSchema })}
          </Button>
        </Group>
      )}
    </Box>
  );
}
