/**
 * Stories for the "being edited" marker on list rows (SPEC §9.8, DR-110).
 * Run `npm run storybook`.
 */

import { Group, Paper, Table, Text } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { BeingEditedView } from '../BeingEdited';
import { ALEX_EDITING } from './leases';

export default { title: 'Being Edited' } satisfies Meta;

export const SomeoneElse: StoryFn = () => (
  <Group m="md">
    <Text>Bob Ross</Text>
    <BeingEditedView lease={ALEX_EDITING} isYou={false} />
  </Group>
);

export const YouInAnotherTab: StoryFn = () => (
  <Group m="md">
    <Text>Bob Ross</Text>
    <BeingEditedView lease={ALEX_EDITING} isYou />
  </Group>
);

export const InAList: StoryFn = () => (
  <Paper withBorder m="md" maw={520}>
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Primary camper</Table.Th>
          <Table.Th>Email</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        <Table.Tr>
          <Table.Td>
            <Group gap={6} wrap="nowrap">
              Bob Ross <BeingEditedView lease={ALEX_EDITING} isYou={false} />
            </Group>
          </Table.Td>
          <Table.Td>bobross@example.com</Table.Td>
        </Table.Tr>
        <Table.Tr>
          <Table.Td>Ani Skywalker</Table.Td>
          <Table.Td>ani@example.com</Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  </Paper>
);

export const Small: StoryFn = () => (
  <Group m="md" gap={4}>
    <Text size="xs">Pat Alpha</Text>
    <BeingEditedView lease={ALEX_EDITING} isYou={false} size="xs" />
  </Group>
);
