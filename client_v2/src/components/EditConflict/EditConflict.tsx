/**
 * The edit conflict (SPEC §9.8, DR-109): a save was refused because someone
 * else saved the record after this form was opened. It shows what each side
 * changed — and where both changed the same thing — and lets the user either
 * put their changes on top of the other person's (keeping everything the other
 * person changed that they didn't) or drop their changes and take the record
 * as it is now. There's no way out without choosing, so an edit is never lost
 * or saved over without being seen.
 *
 * `openEditConflict({ … })` opens it as a modal and resolves to the choice.
 */

import { Alert, Button, Group, List, Stack, Table, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { changedPaths, threeWayMerge } from 'utils/merge';
import { getByPath } from 'utils/object';

export type ConflictChoice = 'reapply' | 'discard';

export interface EditConflictOptions<F extends object> {
  /** What's being edited, e.g. "registration". */
  label: string;
  /** The record as the form was opened with it. */
  base: F;
  /** The form as the user left it. */
  mine: F;
  /** The record as someone else saved it since. */
  theirs: F;
  /** Names for fields, by dotted path (`attributes.first_name`) or last segment. */
  fieldLabels?: Record<string, string>;
}

export function openEditConflict<F extends object>(
  options: EditConflictOptions<F>,
): Promise<ConflictChoice> {
  return new Promise((resolve) => {
    const modalId = modals.open({
      title: 'Someone else changed this',
      size: 'lg',
      closeOnClickOutside: false,
      closeOnEscape: false,
      withCloseButton: false,
      children: (
        <EditConflictView
          {...options}
          onChoose={(choice) => {
            modals.close(modalId);
            resolve(choice);
          }}
        />
      ),
    });
  });
}

export function fieldLabel(path: string, labels: Record<string, string> = {}): string {
  const last = path.split('.').pop() ?? path;
  const label = labels[path] ?? labels[last] ?? last.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '(empty)';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
}

export type EditConflictViewProps<F extends object> = EditConflictOptions<F> & {
  onChoose: (choice: ConflictChoice) => void;
};

export function EditConflictView<F extends object>({
  label,
  base,
  mine,
  theirs,
  fieldLabels,
  onChoose,
}: EditConflictViewProps<F>) {
  const { conflicts } = threeWayMerge(base, mine, theirs);
  const both = new Set(conflicts);
  const theirsOnly = changedPaths(base, theirs).filter((path) => !both.has(path));
  const mineOnly = changedPaths(base, mine).filter((path) => !both.has(path));
  const name = (path: string) => fieldLabel(path, fieldLabels);

  return (
    <Stack>
      <Text size="sm">
        Someone else saved this {label} after you opened it. Your changes haven’t been saved yet.
      </Text>
      {conflicts.length > 0 && (
        <Alert color="yellow" title="You both changed">
          <Table withRowBorders={false} verticalSpacing={2}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Field</Table.Th>
                <Table.Th>Yours</Table.Th>
                <Table.Th>Theirs</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {conflicts.map((path) => (
                <Table.Tr key={path}>
                  <Table.Td>{name(path)}</Table.Td>
                  <Table.Td>{formatValue(getByPath(mine, path))}</Table.Td>
                  <Table.Td>{formatValue(getByPath(theirs, path))}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Alert>
      )}
      {theirsOnly.length > 0 && (
        <div>
          <Text size="sm" fw={500}>
            They changed:
          </Text>
          <List size="sm">
            {theirsOnly.map((path) => (
              <List.Item key={path}>
                {name(path)}: {formatValue(getByPath(theirs, path))}
              </List.Item>
            ))}
          </List>
        </div>
      )}
      {mineOnly.length > 0 && (
        <div>
          <Text size="sm" fw={500}>
            You changed:
          </Text>
          <List size="sm">
            {mineOnly.map((path) => (
              <List.Item key={path}>
                {name(path)}: {formatValue(getByPath(mine, path))}
              </List.Item>
            ))}
          </List>
        </div>
      )}
      <Text size="sm" c="dimmed">
        {conflicts.length > 0
          ? 'Saving yours keeps their other changes, but replaces theirs where you both changed something.'
          : 'Saving yours keeps their changes too.'}
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => onChoose('discard')}>
          Discard mine
        </Button>
        <Button onClick={() => onChoose('reapply')}>Save mine on top of theirs</Button>
      </Group>
    </Stack>
  );
}
