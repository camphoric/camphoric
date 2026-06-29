/**
 * Campers field (SPEC §9.1). Renders the registration's array of campers with an
 * ordinal section heading per camper ("1st Camper", "2nd Camper", …) and
 * add/remove controls. Referenced from an event's uiSchema as
 * `ui:field: 'Campers'`.
 *
 * Implementation: the field re-renders itself as the default SchemaField with
 * `ui:field` cleared (to avoid recursion) and custom array templates injected.
 * In rjsf v6 the per-item chrome lives in ArrayFieldItemTemplate (the ordinal
 * heading + remove button) and the container/add-button in ArrayFieldTemplate.
 */

import { Box, Button, Divider, Group, Title } from '@mantine/core';
import {
  type ArrayFieldItemTemplateProps,
  type ArrayFieldTemplateProps,
  type FieldProps,
  getTemplate,
  getUiOptions,
  type UiSchema,
} from '@rjsf/utils';
import { ordinal } from 'utils/ordinal';

function CampersItemTemplate(props: ArrayFieldItemTemplateProps) {
  const { index, children, buttonsProps, hasToolbar, uiSchema, registry } = props;
  // Reuse the theme's remove/move buttons rather than reaching into buttonsProps.
  const ItemButtons = getTemplate('ArrayFieldItemButtonsTemplate', registry, getUiOptions(uiSchema));
  return (
    <Box className="camphoric-camper" mb="lg">
      <Group justify="space-between" align="flex-end" mb="xs">
        <Title order={5}>{ordinal(index + 1)} Camper</Title>
        {hasToolbar && <ItemButtons {...buttonsProps} />}
      </Group>
      <Divider mb="sm" />
      {children}
    </Box>
  );
}

function CampersArrayTemplate(props: ArrayFieldTemplateProps) {
  const { items, canAdd, onAddClick, disabled, readonly } = props;
  return (
    <Box className="camphoric-campers">
      {items}
      {canAdd && (
        <Button
          className="rjsf-array-item-add"
          variant="light"
          mt="sm"
          disabled={disabled || readonly}
          onClick={onAddClick}
        >
          Add a {ordinal(items.length + 1)} Camper
        </Button>
      )}
    </Box>
  );
}

export function Campers(props: FieldProps) {
  const { SchemaField } = props.registry.fields;

  const itemsUiSchema = (props.uiSchema?.items ?? {}) as UiSchema;
  const uiSchema: UiSchema = {
    ...props.uiSchema,
    'ui:field': undefined,
    'ui:options': {
      ...(props.uiSchema?.['ui:options'] ?? {}),
      ArrayFieldTemplate: CampersArrayTemplate,
      ArrayFieldItemTemplate: CampersItemTemplate,
    },
    // Suppress the auto-generated per-item object title; the ordinal heading
    // ("1st Camper", …) is the label.
    items: {
      ...itemsUiSchema,
      'ui:options': {
        ...((itemsUiSchema['ui:options'] as object) ?? {}),
        label: false,
      },
    },
  };

  return <SchemaField {...props} uiSchema={uiSchema} />;
}
