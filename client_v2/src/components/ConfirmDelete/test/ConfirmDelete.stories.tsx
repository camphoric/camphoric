/**
 * Ladle stories for the delete confirmation (SPEC §5; §15, DR-54): each kind of
 * answer the server's delete preview gives. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Paper } from '@mantine/core';
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

export const Checking: Story = () => <Frame message="Delete “Cabins”?" />;
export const NothingElse: Story = () => (
  <Frame message="Delete “Campers by cabin”?" preview={NOTHING_ELSE} />
);
export const UnassignsCampers: Story = () => (
  <Frame message="Delete “Cabins” and everything under it?" preview={LODGING} />
);
export const Restorable: Story = () => (
  <Frame message="Delete the registration for “pat@example.com”?" preview={REGISTRATION} />
);
export const SentEmail: Story = () => <Frame message="Delete “News”?" preview={SENT_TEMPLATE} />;
export const Blocked: Story = () => <Frame message="Delete “Linens”?" preview={BLOCKED} />;
export const CouldNotCheck: Story = () => (
  <Frame message="Delete “Cabins”?" error={new Error('Network down')} />
);
