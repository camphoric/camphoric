/**
 * A lodging node's name — in the hierarchy, or a timeline unit's row label or
 * section heading — as a button selecting the node, so its details (notes
 * included) show alongside (SPEC §8.6). Without `onSelect` it's plain text.
 * `NotesMarker` goes beside it on the timeline to mark a node that has notes.
 */

import { Anchor, Text, type TextProps } from '@mantine/core';
import { IconNotes } from '@tabler/icons-react';
import type { AugmentedLodging } from 'api-types';
import type { ReactNode } from 'react';

interface LodgingNameButtonProps extends TextProps {
  node: Pick<AugmentedLodging, 'id' | 'name'>;
  /** What to show in place of the node's name, e.g. its path. */
  children?: ReactNode;
  isSelected?: boolean;
  onSelect?: (lodgingId: number) => void;
}

export function LodgingNameButton({
  node,
  children,
  isSelected = false,
  onSelect,
  ...textProps
}: LodgingNameButtonProps) {
  const label = children ?? node.name;
  if (!onSelect) return <Text {...textProps}>{label}</Text>;
  return (
    <Anchor
      component="button"
      type="button"
      ta="left"
      underline="hover"
      {...textProps}
      // Plain until selected, so nodes don't read as links like the campers beside them.
      c={isSelected ? undefined : 'var(--mantine-color-text)'}
      fw={isSelected ? 700 : textProps.fw}
      aria-current={isSelected || undefined}
      onClick={() => onSelect(node.id)}
    >
      {label}
    </Anchor>
  );
}

/** Marks a node that has notes; selecting the node shows them. */
export function NotesMarker() {
  return (
    <Text span c="dimmed" lh={0} role="img" aria-label="Has notes" title="Has notes">
      <IconNotes size={14} />
    </Text>
  );
}
