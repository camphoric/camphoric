/**
 * The delete confirmation (SPEC §5; §15, DR-54): before anything is deleted, the
 * server says exactly what the delete would do — what blocks it, what goes with
 * it, what's left behind but changed, and whether it can be restored — and the
 * confirmation shows that. Delete waits for the answer, and isn't offered when
 * something blocks it or the answer can't be had.
 *
 * `confirmDelete({ … })` opens it as a modal; `onConfirm` does the delete.
 */

import { Alert, Button, Group, List, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import type { ApiDeletePreview, ApiDeletePreviewGroup, Scalar } from 'api-types';
import { InlineLoading } from 'components/Loading';
import type { ReactNode } from 'react';
import { useDeletePreview } from 'store/deletes';
import { apiErrorMessage } from 'utils/fetch';

export interface ConfirmDeleteOptions {
  /** The REST path segment, e.g. `registrations`. */
  path: string;
  id: Scalar;
  title: string;
  /** The question, e.g. Delete the camper “Pat Alpha”? */
  message: ReactNode;
  /** Defaults to "Delete". */
  confirmLabel?: string;
  onConfirm: () => void;
}

export function confirmDelete({ title, ...options }: ConfirmDeleteOptions) {
  const modalId = modals.open({
    title,
    children: <ConfirmDelete {...options} onCancel={() => modals.close(modalId)} />,
  });
  return modalId;
}

type ConfirmDeleteProps = Omit<ConfirmDeleteOptions, 'title'> & { onCancel: () => void };

export function ConfirmDelete({ path, id, onCancel, onConfirm, ...view }: ConfirmDeleteProps) {
  const preview = useDeletePreview(path, id);
  return (
    <ConfirmDeleteView
      {...view}
      preview={preview.data}
      error={preview.error}
      onCancel={onCancel}
      onConfirm={() => {
        onConfirm();
        onCancel();
      }}
    />
  );
}

export interface ConfirmDeleteViewProps {
  message: ReactNode;
  confirmLabel?: string;
  /** Undefined while it's being worked out. */
  preview?: ApiDeletePreview;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteView({
  message,
  confirmLabel = 'Delete',
  preview,
  error,
  onConfirm,
  onCancel,
}: ConfirmDeleteViewProps) {
  return (
    <Stack>
      <Text size="sm">{message}</Text>
      {error ? (
        <Alert color="red" title="Couldn’t check what this would affect">
          {apiErrorMessage(error)}
        </Alert>
      ) : preview ? (
        <PreviewSummary preview={preview} />
      ) : (
        <InlineLoading message="Checking what this would affect…" />
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        {!error && (
          <Button color="red" disabled={!preview?.can_delete} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function PreviewSummary({ preview }: { preview: ApiDeletePreview }) {
  if (!preview.can_delete) {
    return (
      <Alert color="orange" title="This can’t be deleted">
        <Stack gap="xs">
          {preview.blocked_by.map((blocker) => (
            <div key={blocker.detail}>
              <Text size="sm">{blocker.detail}</Text>
              <Names items={blocker.items} count={blocker.count} />
            </div>
          ))}
        </Stack>
      </Alert>
    );
  }

  const nothingElse = preview.deletes.length === 0 && preview.changes.length === 0;
  return (
    <Stack gap="xs">
      {preview.deletes.length > 0 && (
        <Section
          title={
            preview.restorable
              ? 'These go with it, and come back if it’s restored:'
              : 'Also deleted with it:'
          }
          groups={preview.deletes}
        />
      )}
      {preview.changes.map((change) => (
        <div key={`${change.type}:${change.description}`}>
          <Text size="sm">
            {countOf(change)} {change.description}
          </Text>
          <Names items={change.items} count={change.count} />
        </div>
      ))}
      <Text size="sm" c="dimmed">
        {preview.restorable
          ? 'It can be restored later.'
          : nothingElse
            ? 'Nothing else is affected. This can’t be undone.'
            : 'This can’t be undone.'}
      </Text>
    </Stack>
  );
}

function Section({ title, groups }: { title: string; groups: ApiDeletePreviewGroup[] }) {
  return (
    <div>
      <Text size="sm">{title}</Text>
      <List size="sm" withPadding>
        {groups.map((group) => (
          <List.Item key={group.type}>
            {countOf(group)}
            {group.items.length > 0 && `: ${named(group.items, group.count)}`}
          </List.Item>
        ))}
      </List>
    </div>
  );
}

/** Up to the listed names, then how many more. */
function Names({ items, count }: { items: string[]; count: number }) {
  if (items.length === 0) return null;
  return (
    <Text size="sm" c="dimmed">
      {named(items, count)}
    </Text>
  );
}

const countOf = (group: ApiDeletePreviewGroup) => `${group.count} ${group.name}`;

export function named(items: string[], count: number): string {
  const more = count - items.length;
  return more > 0 ? `${items.join(', ')}, and ${more} more` : items.join(', ');
}
