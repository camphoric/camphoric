/**
 * An icon beside a lodging node in the hierarchy that opens the node's notes
 * (SPEC §8.6). It opens on click, not hover: hover has no equivalent on touch
 * screens (§15, DR-70).
 */

import { ActionIcon, Popover, Text } from '@mantine/core';
import { IconNotes } from '@tabler/icons-react';

interface NoteIndicatorProps {
  /** The node's name, naming the icon for assistive tech. */
  name: string;
  notes: string;
}

export function NoteIndicator({ name, notes }: NoteIndicatorProps) {
  return (
    <Popover position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Notes for ${name}`}>
          <IconNotes size={14} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown maw={320}>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {notes}
        </Text>
      </Popover.Dropdown>
    </Popover>
  );
}
