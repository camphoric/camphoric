/**
 * LodgingRequested field (SPEC §9.1). A cascading select that walks the lodging
 * tree one level at a time: pick a top-level node, then its children, and so on.
 * Only a **leaf** node is a valid final choice. The stored value tracks the full
 * path plus the resolved leaf:
 *   { choices: number[]; id?: number; name?: string }
 * `id`/`name` are set only when the current selection is a leaf.
 *
 * The lodging tree (a flat array of nodes, with computed remaining capacity) is
 * provided on the field's uiSchema as `lodging_nodes`. Full nodes — the server's
 * `full`: out of room, or marked full by an organizer (and not when marked open;
 * #602) — are labelled "(full)" and disabled. Referenced from an event's
 * uiSchema as `ui:field: 'LodgingRequested'`.
 *
 * Validation errors — the field's own, and those on its `id` / `choices`
 * (e.g. a non-leaf choice such as "RV Camping" with no length picked yet) —
 * show under the last dropdown, so the unfinished choice is marked.
 *
 * The dropdowns form a group named by the field's title (`ui:title`, else the
 * schema's; `ui:label: false` hides it). Each dropdown is labelled by its
 * parent's `children_title` — else, at the top, the field's title, and below,
 * the parent's name — so a screen reader still says what it is once a value is
 * picked. When the field must be finished (it's required, or its schema
 * requires `id` or `choices`, as the server's does) every dropdown is required.
 */

import { Input, Select, Stack } from '@mantine/core';
import { type FieldProps, getUiOptions, titleId } from '@rjsf/utils';

export interface LodgingNode {
  id: number;
  parent: number | null;
  name: string;
  children_title: string;
  remaining_unreserved_capacity: number;
  /** Offered as full; older servers only send the remaining capacity. */
  full?: boolean;
}

const isFull = (node: LodgingNode) => node.full ?? node.remaining_unreserved_capacity <= 0;

interface LodgingRequestedValue {
  choices?: number[];
  id?: number;
  name?: string;
}

/** The field's own errors plus those rjsf files under its `id` and `choices`. */
function lodgingErrors(props: FieldProps): string[] {
  if (props.hideError) return [];
  const children = (props.errorSchema ?? {}) as Record<
    string,
    { __errors?: unknown[] } | undefined
  >;
  const all = [
    ...(props.rawErrors ?? []),
    ...(children.id?.__errors ?? []),
    ...(children.choices?.__errors ?? []),
  ].filter((error): error is string => typeof error === 'string' && error !== '');
  return [...new Set(all)];
}

/** Whether a lodging must be chosen: the field is required, or its own schema requires a choice. */
function isRequired(props: FieldProps): boolean {
  const required = props.schema.required ?? [];
  return Boolean(props.required) || required.includes('id') || required.includes('choices');
}

export function LodgingRequested(props: FieldProps) {
  const uiSchema = props.uiSchema as { lodging_nodes?: LodgingNode[] } | undefined;
  const nodes = uiSchema?.lodging_nodes ?? [];
  const root = nodes.find((node) => node.parent === null);
  const value = (props.formData ?? {}) as LodgingRequestedValue;
  const choices = (value.choices ?? []).filter((id): id is number => Boolean(id));

  const isLeaf = (id: number | undefined) => !nodes.some((node) => node.parent === id);

  const handleSelect = (selectedId: number | undefined, level: number) => {
    const nextChoices = [...choices.slice(0, level), selectedId].filter((id): id is number =>
      Boolean(id),
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

  const errors = lodgingErrors(props);
  const required = isRequired(props);
  const uiOptions = getUiOptions(props.uiSchema);
  const title = uiOptions.label === false ? undefined : uiOptions.title || props.schema.title;
  const labelId = titleId(props.fieldPathId);

  // Build the chain of selects: the root, then one per chosen non-leaf node
  // (a chosen node with children opens the next level).
  const parents: LodgingNode[] = [root];
  choices.forEach((chosenId) => {
    const node = nodes.find((n) => n.id === chosenId);
    if (node && !isLeaf(node.id)) parents.push(node);
  });

  return (
    // The field's rjsf id lets a failed submit focus the picker (focusFirstError).
    <Stack
      id={props.fieldPathId.$id}
      className="field-lodging-requested"
      gap="sm"
      role="group"
      aria-labelledby={title ? labelId : undefined}
    >
      {title && (
        <Input.Label id={labelId} labelElement="div" required={required} mb={0}>
          {title}
        </Input.Label>
      )}
      {parents.map((parent, level) => {
        const optionNodes = nodes
          .filter((node) => node.parent === parent.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        const data = optionNodes.map((node) => ({
          value: String(node.id),
          label: isFull(node) ? `${node.name} (full)` : node.name,
          disabled: isFull(node),
        }));
        return (
          <Select
            key={parent.id}
            label={parent.children_title || (level === 0 ? title : parent.name) || 'Lodging'}
            placeholder="Please make a selection"
            required={required}
            // The group's title already carries the required mark.
            withAsterisk={title ? false : undefined}
            data={data}
            value={choices[level] !== undefined ? String(choices[level]) : null}
            onChange={(next) => handleSelect(next ? Number(next) : undefined, level)}
            disabled={props.disabled || props.readonly}
            error={level === parents.length - 1 && errors.length ? errors.join('\n') : undefined}
          />
        );
      })}
    </Stack>
  );
}
