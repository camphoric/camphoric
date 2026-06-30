/**
 * The registration's campers (SPEC §8.4): listed by `sequence`, each linking to
 * the camper editor, with up/down controls to change their order (PATCH
 * `sequence`).
 */

import { ActionIcon, Anchor, Group, Stack, Text, Title } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { ApiCamper, AugmentedRegistration } from 'api-types';
import { camperHooks } from 'store/entities';

const FROM = '/admin/organization/$organizationId/event/$eventId';

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const camperName = (c: ApiCamper) =>
  `${str(c.attributes.first_name)} ${str(c.attributes.last_name)}`.trim() || `Camper ${c.id}`;

export function RegistrationCampers({ registration }: { registration: AugmentedRegistration }) {
  const { organizationId, eventId } = useParams({ from: FROM });
  const navigate = useNavigate();
  const update = camperHooks.useUpdate();

  const campers = [...registration.campers].sort((a, b) => a.sequence - b.sequence);

  const openCamper = (id: number) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/campers',
      params: { organizationId, eventId },
      search: { camperId: String(id) },
    });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= campers.length) return;
    const reordered = [...campers];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    // Persist the new sequence for any camper whose position changed.
    reordered.forEach((c, i) => {
      if (c.sequence !== i) update.mutate({ id: c.id, sequence: i });
    });
  };

  if (campers.length === 0) {
    return (
      <Stack>
        <Title order={4}>Campers</Title>
        <Text c="dimmed" size="sm">
          No campers.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack>
      <Title order={4}>Campers</Title>
      <Stack gap="xs" maw={420}>
        {campers.map((c, i) => (
          <Group key={c.id} justify="space-between">
            <Anchor component="button" type="button" onClick={() => openCamper(c.id)}>
              {i + 1}. {camperName(c)}
            </Anchor>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="default"
                onClick={() => move(i, -1)}
                disabled={i === 0 || update.isPending}
                aria-label="Move up"
              >
                <IconChevronUp size={16} />
              </ActionIcon>
              <ActionIcon
                variant="default"
                onClick={() => move(i, 1)}
                disabled={i === campers.length - 1 || update.isPending}
                aria-label="Move down"
              >
                <IconChevronDown size={16} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
