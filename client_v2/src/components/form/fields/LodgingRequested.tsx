/**
 * LodgingRequested field (SPEC §9.1). A cascading select that walks the lodging
 * tree one level at a time: pick a top-level node, then its children, and so on.
 * Only a **leaf** node is a valid final choice. The stored value tracks the full
 * path plus the resolved leaf:
 *   { choices: number[]; id?: number; name?: string }
 * `id`/`name` are set only when the current selection is a leaf.
 *
 * The lodging tree (a flat array of nodes, with computed remaining capacity) is
 * provided on the field's uiSchema as `lodging_nodes`. Nodes with no remaining
 * capacity are labelled "(full)" and disabled. Referenced from an event's
 * uiSchema as `ui:field: 'LodgingRequested'`.
 */

import { Select, Stack } from '@mantine/core';
import type { FieldProps } from '@rjsf/utils';

export interface LodgingNode {
  id: number;
  parent: number | null;
  name: string;
  children_title: string;
  remaining_unreserved_capacity: number;
}

interface LodgingRequestedValue {
  choices?: number[];
  id?: number;
  name?: string;
}

export function LodgingRequested(props: FieldProps) {
  const uiSchema = props.uiSchema as { lodging_nodes?: LodgingNode[] } | undefined;
  const nodes = uiSchema?.lodging_nodes ?? [];
  const root = nodes.find((node) => node.parent === null);
  const value = (props.formData ?? {}) as LodgingRequestedValue;
  const choices = (value.choices ?? []).filter((id): id is number => Boolean(id));

  const isLeaf = (id: number | undefined) => !nodes.some((node) => node.parent === id);

  const handleSelect = (selectedId: number | undefined, level: number) => {
    const nextChoices = [...choices.slice(0, level), selectedId].filter(
      (id): id is number => Boolean(id),
    );
    const node = nodes.find((n) => n.id === selectedId);
    // v6 requires the field's own path so the value lands at this property.
    props.onChange(
      {
        choices: nextChoices,
        id: isLeaf(selectedId) ? selectedId : undefined,
        name: isLeaf(selectedId) ? node?.name : undefined,
      },
      props.fieldPathId.path,
    );
  };

  if (!root) return null;

  // Build the chain of selects: the root, then one per chosen non-leaf node
  // (a chosen node with children opens the next level).
  const parents: LodgingNode[] = [root];
  choices.forEach((chosenId) => {
    const node = nodes.find((n) => n.id === chosenId);
    if (node && !isLeaf(node.id)) parents.push(node);
  });

  return (
    <Stack id="field-lodging-requested" className="field-lodging-requested" gap="sm">
      {parents.map((parent, level) => {
        const optionNodes = nodes
          .filter((node) => node.parent === parent.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        const data = optionNodes.map((node) => ({
          value: String(node.id),
          label: node.remaining_unreserved_capacity <= 0 ? `${node.name} (full)` : node.name,
          disabled: node.remaining_unreserved_capacity <= 0,
        }));
        return (
          <Select
            key={parent.id}
            placeholder={`${parent.children_title || 'Please make a selection'} *`}
            data={data}
            value={choices[level] !== undefined ? String(choices[level]) : null}
            onChange={(next) => handleSelect(next ? Number(next) : undefined, level)}
            disabled={props.disabled || props.readonly}
          />
        );
      })}
    </Stack>
  );
}
