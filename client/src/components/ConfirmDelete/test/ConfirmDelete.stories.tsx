/**
 * Stories for the delete confirmation (SPEC §5; §15, DR-54): each kind of
 * answer the server's delete preview gives. Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import type { ApiDeletePreview } from 'api-types';

import { ConfirmDeleteView } from '../ConfirmDelete';
import { BLOCKED, LODGING, NOTHING_ELSE, REGISTRATION, SENT_TEMPLATE } from './previews';

function Frame({
  message,
  preview,
  error,
}: {
  message: string;
  preview?: ApiDeletePreview;
  error?: unknown;
}) {
  return (
    <Paper withBorder p="md" m="md" maw={480}>
      <ConfirmDeleteView
        message={message}
        preview={preview}
        error={error}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />
    </Paper>
  );
}

export default { title: 'Confirm Delete' } satisfies Meta;

export const Checking: StoryFn = () => <Frame message="Delete “Cabins”?" />;
export const NothingElse: StoryFn = () => (
  <Frame message="Delete “Campers by cabin”?" preview={NOTHING_ELSE} />
);
export const UnassignsCampers: StoryFn = () => (
  <Frame message="Delete “Cabins” and everything under it?" preview={LODGING} />
);
export const Restorable: StoryFn = () => (
  <Frame message="Delete the registration for “pat@example.com”?" preview={REGISTRATION} />
);
export const SentEmail: StoryFn = () => <Frame message="Delete “News”?" preview={SENT_TEMPLATE} />;
export const Blocked: StoryFn = () => <Frame message="Delete “Linens”?" preview={BLOCKED} />;
export const CouldNotCheck: StoryFn = () => (
  <Frame message="Delete “Cabins”?" error={new Error('Network down')} />
);
