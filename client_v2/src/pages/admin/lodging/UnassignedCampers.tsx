/**
 * Campers not yet placed in a leaf unit (SPEC §8.6), with the context needed to
 * place them: name, requested lodging, sharing preference/partner, and comments.
 */

import { Anchor, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { ApiCamper, LodgingLookup } from 'api-types';
import { camperName } from 'utils/camper';

interface UnassignedCampersProps {
  campers: ApiCamper[];
  lodgingLookup: LodgingLookup;
  onAssign: (camper: ApiCamper) => void;
  onSelect: (camperId: number) => void;
}

export function UnassignedCampers({
  campers,
  lodgingLookup,
  onAssign,
  onSelect,
}: UnassignedCampersProps) {
  const requestedName = (c: ApiCamper) =>
    c.lodging_requested == null
      ? null
      : (lodgingLookup[String(c.lodging_requested)]?.fullPath ?? null);

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>Unassigned campers ({campers.length})</Title>
        {campers.length === 0 ? (
          <Text c="dimmed" size="sm">
            All campers are assigned.
          </Text>
        ) : (
          campers.map((c) => {
            const requested = requestedName(c);
            return (
              <Stack key={c.id} gap={2}>
                <Group justify="space-between" wrap="nowrap">
                  <Anchor component="button" type="button" size="sm" onClick={() => onSelect(c.id)}>
                    {camperName(c)}
                  </Anchor>
                  <Button size="compact-xs" variant="light" onClick={() => onAssign(c)}>
                    Assign
                  </Button>
                </Group>
                {requested && (
                  <Text size="xs" c="dimmed">
                    Requested: {requested}
                  </Text>
                )}
                {c.lodging_shared && (
                  <Text size="xs" c="dimmed">
                    Shares with {c.lodging_shared_with || '(unspecified)'}
                  </Text>
                )}
                {c.lodging_comments && (
                  <Text size="xs" c="dimmed">
                    {c.lodging_comments}
                  </Text>
                )}
              </Stack>
            );
          })
        )}
      </Stack>
    </Card>
  );
}
