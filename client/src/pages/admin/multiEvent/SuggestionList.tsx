/**
 * Suggested matches (SPEC §8.12; §15 DR-178): camper records from different
 * events that are likely one person, each with how strong the match is and
 * why. They're only proposals: a user who can change data links one as one
 * person, or says they aren't the same person so it isn't suggested again.
 */

import { Anchor, Badge, Button, Card, Group, Stack, Table, Text } from '@mantine/core';
import type {
  ApiMultiEventCamper,
  ApiMultiEventEvent,
  ApiPersonSuggestion,
  MatchLevel,
} from 'api-types';
import { usePermissions } from 'hooks/permissions';

import { describeReasons } from './people';

export const LEVEL_COLOR: Record<MatchLevel, string> = {
  strong: 'green',
  likely: 'blue',
  possible: 'yellow',
};

export const LEVEL_LABEL: Record<MatchLevel, string> = {
  strong: 'Strong match',
  likely: 'Likely match',
  possible: 'Possible match',
};

interface SuggestionListProps {
  suggestions: ApiPersonSuggestion[];
  /** The camper records, by id. */
  records: Map<number, ApiMultiEventCamper>;
  /** The organization's events, by id. */
  events: Map<number, ApiMultiEventEvent>;
  onLink: (suggestion: ApiPersonSuggestion) => void;
  onDismiss: (suggestion: ApiPersonSuggestion) => void;
  onOpenCamper: (record: ApiMultiEventCamper) => void;
  /** The suggestion being linked or dismissed (by its first record). */
  busy?: number | null;
  emptyMessage?: string;
}

export function SuggestionList({
  suggestions,
  records,
  events,
  onLink,
  onDismiss,
  onOpenCamper,
  busy,
  emptyMessage = 'No suggested matches.',
}: SuggestionListProps) {
  const { canEdit } = usePermissions();
  if (suggestions.length === 0) return <Text c="dimmed">{emptyMessage}</Text>;

  return (
    <Stack>
      {suggestions.map((suggestion) => {
        const rows = suggestion.campers
          .map((id) => records.get(id))
          .filter((r): r is ApiMultiEventCamper => !!r);
        const key = suggestion.campers[0];
        return (
          <Card key={suggestion.campers.join('-')} withBorder padding="sm">
            <Stack gap="xs">
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Group gap="xs">
                  <Text fw={600}>{suggestion.name}</Text>
                  <Badge variant="light" color={LEVEL_COLOR[suggestion.level]}>
                    {LEVEL_LABEL[suggestion.level]}
                  </Badge>
                </Group>
                {canEdit && (
                  <Group gap="xs">
                    <Button
                      size="xs"
                      onClick={() => onLink(suggestion)}
                      loading={busy === key}
                      disabled={busy != null && busy !== key}
                    >
                      Link as one person
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => onDismiss(suggestion)}
                      disabled={busy != null}
                    >
                      Not the same person
                    </Button>
                  </Group>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {describeReasons(suggestion.reasons)}
              </Text>
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing={4} fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Event</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Age</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Registrant email</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((record) => (
                      <Table.Tr key={record.camper}>
                        <Table.Td>
                          <Anchor
                            component="button"
                            type="button"
                            fz="sm"
                            ta="left"
                            onClick={() => onOpenCamper(record)}
                          >
                            {events.get(record.event)?.name ?? `Event ${record.event}`}
                          </Anchor>
                        </Table.Td>
                        <Table.Td>
                          {record.name}
                          {record.person !== null && (
                            <Badge ml="xs" size="xs" variant="outline" color="gray">
                              Linked
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>{record.age ?? ''}</Table.Td>
                        <Table.Td>{record.email ?? ''}</Table.Td>
                        <Table.Td>{record.registrant_email ?? ''}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
