/**
 * Your personal access tokens (SPEC §6; #965): the tokens your scripts, such as
 * the event importer, use to call the API as you. List them, make one — its
 * token shown once, right after — and revoke one. Changing your password
 * revokes them all.
 */

import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import type { ApiNewToken } from 'api-types';
import {
  ApiTokenList,
  confirmRevokeToken,
  NewTokenForm,
  NewTokenSecret,
} from 'components/ApiTokens';
import { InlineLoading } from 'components/Loading';
import { useCurrentUser } from 'hooks/auth';
import { useState } from 'react';
import { useCreateToken, useMyTokens, useRevokeToken } from 'store/tokens';
import { apiErrorMessage } from 'utils/fetch';

interface ApiTokensModalProps {
  opened: boolean;
  onClose: () => void;
}

/** What the modal shows: the list, the form for a new token, or the token just made. */
type View = { kind: 'list' } | { kind: 'new' } | { kind: 'made'; token: ApiNewToken };

export function ApiTokensModal({ opened, onClose }: ApiTokensModalProps) {
  const { data: me } = useCurrentUser();
  const tokens = useMyTokens(opened);
  const create = useCreateToken();
  const revoke = useRevokeToken();
  const [view, setView] = useState<View>({ kind: 'list' });

  const showList = () => {
    create.reset();
    setView({ kind: 'list' });
  };
  // Closing forgets the token just made, so it's never shown again.
  const close = () => {
    showList();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={view.kind === 'list' ? 'Personal access tokens' : 'New personal access token'}
      size="lg"
    >
      {view.kind === 'made' ? (
        <NewTokenSecret token={view.token} onDone={showList} />
      ) : view.kind === 'new' ? (
        <NewTokenForm
          maxDays={me?.api_token_max_days ?? null}
          saving={create.isPending}
          error={create.error}
          onCancel={showList}
          onSubmit={(body) =>
            create.mutate(body, { onSuccess: (token) => setView({ kind: 'made', token }) })
          }
        />
      ) : (
        <Stack>
          <Text size="sm" c="dimmed">
            Tokens let your scripts, such as the event importer, use Camphoric’s API as you. Each
            can do no more than your permission group allows, and none can manage users, apps or
            tokens. Changing your password revokes them all.
          </Text>
          <Group justify="flex-end">
            <Button leftSection={<IconPlus size={16} />} onClick={() => setView({ kind: 'new' })}>
              New token
            </Button>
          </Group>
          {tokens.isPending ? (
            <InlineLoading />
          ) : tokens.isError ? (
            <Alert color="red">{apiErrorMessage(tokens.error)}</Alert>
          ) : (
            <ApiTokenList
              tokens={tokens.data}
              emptyMessage="You haven’t made any tokens."
              revokingId={revoke.isPending ? revoke.variables?.tokenId : undefined}
              onRevoke={(token) =>
                confirmRevokeToken({
                  token,
                  onConfirm: () =>
                    revoke.mutate(
                      { tokenId: token.id },
                      {
                        onSuccess: () =>
                          notifications.show({
                            color: 'green',
                            message: `${token.name} is revoked.`,
                          }),
                      },
                    ),
                })
              }
            />
          )}
        </Stack>
      )}
    </Modal>
  );
}
