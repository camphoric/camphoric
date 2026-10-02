/**
 * A user's change history (SPEC §8.10; §15, DR-80): everything they changed, in
 * every event, newest first — what it was and each field's old and new value,
 * the changes one save made shown together. Older changes load a page at a
 * time. The page fetches the entries (`useUserHistory`); this shows them.
 */

import { Button, Card, CloseButton, Group, Stack, Text, Title } from '@mantine/core';
import type { ApiHistoryEntry, ApiManagedUser } from 'api-types';
import { HistoryList } from 'components/History';
import { InlineLoading } from 'components/Loading';

import { fullName } from './UsersTable';

const OPTIONS = { nameEveryObject: true };

interface UserHistoryPanelProps {
  user: ApiManagedUser;
  /** Undefined while the first page loads. */
  entries?: ApiHistoryEntry[];
  /** How many changes they've made in all. */
  total?: number;
  error?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}

export function UserHistoryPanel({
  user,
  entries,
  total,
  error,
  hasMore,
  loadingMore,
  onLoadMore,
  onClose,
}: UserHistoryPanelProps) {
  const name = fullName(user) || user.username;
  return (
    <Card withBorder component="section" aria-label={`Changes by ${name}`}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <Title order={3} size="h4">
              Changes by {name}
            </Title>
            <Text size="sm" c="dimmed">
              In every event, newest first
              {total !== undefined && ` · ${total} ${total === 1 ? 'change' : 'changes'}`}
            </Text>
          </div>
          <CloseButton aria-label="Close history" onClick={onClose} />
        </Group>
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : entries ? (
          <>
            <HistoryList entries={entries} options={OPTIONS} showActor={false} />
            {hasMore && (
              <Button variant="default" onClick={onLoadMore} loading={loadingMore}>
                Show older changes
              </Button>
            )}
          </>
        ) : (
          <InlineLoading message="Loading changes…" />
        )}
      </Stack>
    </Card>
  );
}
