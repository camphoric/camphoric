/**
 * Review exactly who a group email goes to (SPEC §8.9): a checkbox per
 * recipient — who they are, their address and name, and whether this email
 * already reached them — with search, and select all or none of those shown.
 * When already-sent recipients are skipped, they're marked as not getting it.
 */

import { Badge, Button, Checkbox, Group, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { AudienceRecipient } from 'api-types';
import { useMemo, useState } from 'react';

interface RecipientReviewTableProps {
  recipients: AudienceRecipient[];
  /** The chosen recipients' keys. */
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  /** Already-sent recipients won't get it again. */
  skipAlreadySent: boolean;
  disabled?: boolean;
}

function matches(recipient: AudienceRecipient, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [recipient.label, recipient.email, recipient.name].some((text) =>
    text.toLowerCase().includes(q),
  );
}

export function RecipientReviewTable({
  recipients,
  selected,
  onSelectedChange,
  skipAlreadySent,
  disabled,
}: RecipientReviewTableProps) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => recipients.filter((r) => matches(r, query)), [recipients, query]);
  const shownSelected = shown.filter((r) => selected.has(r.key)).length;

  const setShown = (on: boolean) => {
    const next = new Set(selected);
    for (const r of shown) {
      if (on) next.add(r.key);
      else next.delete(r.key);
    }
    onSelectedChange(next);
  };
  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onSelectedChange(next);
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="wrap">
        <TextInput
          aria-label="Search recipients"
          placeholder="Search name or address…"
          leftSection={<IconSearch size={14} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          w={280}
        />
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            onClick={() => setShown(true)}
            disabled={disabled || !shown.length}
          >
            Select all{query ? ' shown' : ''}
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={() => setShown(false)}
            disabled={disabled || !shownSelected}
          >
            Select none{query ? ' shown' : ''}
          </Button>
        </Group>
      </Group>
      <Table.ScrollContainer minWidth={520} mah={360}>
        <Table striped stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40}>
                <Checkbox
                  aria-label="Select all shown"
                  checked={shown.length > 0 && shownSelected === shown.length}
                  indeterminate={shownSelected > 0 && shownSelected < shown.length}
                  onChange={(e) => setShown(e.currentTarget.checked)}
                  disabled={disabled || !shown.length}
                />
              </Table.Th>
              <Table.Th>For</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Name</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shown.map((r) => (
              <Table.Tr key={r.key}>
                <Table.Td>
                  <Checkbox
                    aria-label={`Send to ${r.label}`}
                    checked={selected.has(r.key)}
                    onChange={(e) => toggle(r.key, e.currentTarget.checked)}
                    disabled={disabled}
                  />
                </Table.Td>
                <Table.Td>
                  {r.label}{' '}
                  {r.already_sent && (
                    <Badge size="xs" variant="light" color={skipAlreadySent ? 'gray' : 'yellow'}>
                      {skipAlreadySent ? 'Already sent: skipped' : 'Already sent'}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{r.email}</Table.Td>
                <Table.Td>{r.name}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {!shown.length && (
        <Text size="sm" c="dimmed">
          {recipients.length ? 'No recipients match the search.' : 'No recipients.'}
        </Text>
      )}
    </Stack>
  );
}
