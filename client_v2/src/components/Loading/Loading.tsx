/**
 * Loading indicators (SPEC §9.6, §10): a full-surface variant for whole-screen
 * waits (bootstrap, route loads) and an inline variant for in-place spinners.
 */

import { Center, Loader, Stack, Text } from '@mantine/core';

interface LoadingProps {
  message?: string;
}

/** Fills its container and centers a spinner — for whole-screen / route waits. */
export function FullScreenLoading({ message }: LoadingProps) {
  return (
    <Center h="100vh" w="100%">
      <Stack align="center" gap="sm">
        <Loader />
        {message ? <Text c="dimmed">{message}</Text> : null}
      </Stack>
    </Center>
  );
}

/** A small inline spinner — for in-place waits within a panel. */
export function InlineLoading({ message }: LoadingProps) {
  return (
    <Center p="md">
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        {message ? (
          <Text size="sm" c="dimmed">
            {message}
          </Text>
        ) : null}
      </Stack>
    </Center>
  );
}
