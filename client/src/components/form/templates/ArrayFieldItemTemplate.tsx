/**
 * One item of an array field (SPEC §9.1; §15 DR-49): a bordered box holding
 * the item's fields, with its buttons (remove, and move or copy when the
 * uiSchema allows them) in the box's top-right corner — so several items, such
 * as parking passes, read as separate things, each with its own ×.
 */

import { Box, Group, Paper } from '@mantine/core';
import { type ArrayFieldItemTemplateProps, getTemplate, getUiOptions } from '@rjsf/utils';

export function ArrayFieldItemTemplate(props: ArrayFieldItemTemplateProps) {
  const { buttonsProps, className, hasToolbar, uiSchema, registry, children } = props;
  const ArrayFieldItemButtonsTemplate = getTemplate(
    'ArrayFieldItemButtonsTemplate',
    registry,
    getUiOptions(uiSchema),
  );

  return (
    <Paper withBorder radius="md" p="md" pos="relative" className={className || 'rjsf-array-item'}>
      {hasToolbar && (
        <Group
          gap={2}
          wrap="nowrap"
          pos="absolute"
          top={8}
          right={8}
          className="rjsf-array-item-toolbar"
        >
          <ArrayFieldItemButtonsTemplate {...buttonsProps} />
        </Group>
      )}
      {/* Room for the buttons beside the item's heading. */}
      <Box pr={hasToolbar ? 40 : 0}>{children}</Box>
    </Paper>
  );
}
