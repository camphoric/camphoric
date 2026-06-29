/**
 * Create or edit a lodging node (SPEC §8.6). A node has a name, a title for its
 * children, capacity (0 ⇒ auto-sum of children), reserved count, a sharing
 * multiplier, visibility, and notes. New nodes are created under the given
 * parent (null for the root). Persists via POST (new) or PATCH (edit).
 */

import { Button, Group, Modal, NumberInput, Stack, Switch, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiLodging, Scalar } from 'api-types';
import { useState } from 'react';
import { lodgingHooks } from 'store/entities';

interface LodgingNodeFormProps {
  eventId: Scalar;
  /** Parent node id for a new child (null for the root). Ignored when editing. */
  parentId?: Scalar | null;
  /** Omitted when creating. */
  node?: ApiLodging;
  opened: boolean;
  onClose: () => void;
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0);

export function LodgingNodeForm({ eventId, parentId, node, opened, onClose }: LodgingNodeFormProps) {
  const create = lodgingHooks.useCreate();
  const update = lodgingHooks.useUpdate();

  const [name, setName] = useState(node?.name ?? '');
  const [childrenTitle, setChildrenTitle] = useState(node?.children_title ?? '');
  const [capacity, setCapacity] = useState<number | string>(node?.capacity ?? 0);
  const [reserved, setReserved] = useState<number | string>(node?.reserved ?? 0);
  const [sharingMultiplier, setSharingMultiplier] = useState<number | string>(
    node?.sharing_multiplier ?? 1,
  );
  const [visible, setVisible] = useState(node?.visible ?? true);
  const [notes, setNotes] = useState(node?.notes ?? '');

  const save = () => {
    if (!name.trim()) return;
    const fields = {
      name,
      children_title: childrenTitle,
      capacity: num(capacity),
      reserved: num(reserved),
      sharing_multiplier: num(sharingMultiplier),
      visible,
      notes,
    };
    const onSuccess = () => {
      notifications.show({ color: 'green', message: 'Lodging saved' });
      onClose();
    };
    if (node) {
      update.mutate({ id: node.id, ...fields }, { onSuccess });
    } else {
      create.mutate({ event: eventId, parent: parentId ?? null, ...fields }, { onSuccess });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={node ? 'Edit lodging' : 'New lodging'}>
      <Stack>
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Children title"
          description="Label for this node's child units (e.g. “Rooms”)."
          value={childrenTitle}
          onChange={(e) => setChildrenTitle(e.currentTarget.value)}
        />
        <Group grow>
          <NumberInput
            label="Capacity"
            description="0 = sum of children"
            value={capacity}
            onChange={setCapacity}
            min={0}
          />
          <NumberInput label="Reserved" value={reserved} onChange={setReserved} min={0} />
        </Group>
        <NumberInput
          label="Sharing multiplier"
          value={sharingMultiplier}
          onChange={setSharingMultiplier}
          min={0}
          step={0.5}
        />
        <Switch
          label="Visible"
          checked={visible}
          onChange={(e) => setVisible(e.currentTarget.checked)}
        />
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={create.isPending || update.isPending}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
