/**
 * Temporary placeholder for routes whose real screens land in later phases.
 * The routing shell, guard, and bootstrap are wired now (Phase 1); these mark
 * where each feature surface will be built.
 */

import { Badge, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

interface PlaceholderProps {
  title: string;
  phase: string;
  children?: ReactNode;
}

export function Placeholder({ title, phase, children }: PlaceholderProps) {
  return (
    <Stack p="lg" gap="sm">
      <Title order={2}>{title}</Title>
      <Badge variant="light" color="gray" w="fit-content">
        {phase}
      </Badge>
      {children ?? <Text c="dimmed">This surface is not built yet.</Text>}
    </Stack>
  );
}
