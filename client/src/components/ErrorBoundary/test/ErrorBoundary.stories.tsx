/**
 * Stories for the error boundary (SPEC §9.6, §11): children that render, a
 * child that throws (the default alert — the error's message in dev, a generic
 * one in prod), and a custom fallback. Run `npm run storybook`.
 */

import { Box, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { ErrorBoundary } from '../ErrorBoundary';

function Throws(): never {
  throw new Error('The report template could not be rendered.');
}

export default { title: 'Error Boundary' } satisfies Meta;

export const Healthy: StoryFn = () => (
  <Box p="md">
    <ErrorBoundary>
      <Text>Everything inside rendered.</Text>
    </ErrorBoundary>
  </Box>
);

export const Caught: StoryFn = () => (
  <Box p="md">
    <ErrorBoundary>
      <Throws />
    </ErrorBoundary>
  </Box>
);

export const CustomFallback: StoryFn = () => (
  <Box p="md">
    <ErrorBoundary fallback={(error) => <Text c="red">Couldn’t show this: {error.message}</Text>}>
      <Throws />
    </ErrorBoundary>
  </Box>
);
