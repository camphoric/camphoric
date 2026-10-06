/**
 * Stories for the light/dark toggle (SPEC §9.6; §15, DR-101): in a header, as
 * the admin carries it, and above a page without one. Leave the toolbar's
 * colour scheme on System — Light and Dark there force the scheme, and the
 * toggle can't change it. A choice made here is remembered, as in the app;
 * choose System to go back to following the OS. Run `npm run storybook`.
 */

import { Container, Group, Paper, Text, Title } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { ColorSchemeToggle, CornerColorSchemeToggle } from '../ColorSchemeToggle';

export default { title: 'Color Scheme Toggle' } satisfies Meta;

export const InHeader: StoryFn = () => (
  <Paper withBorder p="xs" px="md" m="md">
    <Group justify="space-between" wrap="nowrap">
      <Title order={4}>Camphoric Admin</Title>
      <ColorSchemeToggle />
    </Group>
  </Paper>
);

export const Corner: StoryFn = () => (
  <>
    <CornerColorSchemeToggle />
    <Container size="sm">
      <Title order={1}>Camp registration</Title>
      <Text mt="md">
        A page without a header, such as registration, has the toggle at its top right.
      </Text>
    </Container>
  </>
);
