/**
 * Users (SPEC §8.10; §15 DR-50, DR-52), for Admins only, shown in the Users
 * overlay (UsersOverlay). Lists everyone who can sign in; add a user
 * (`?userId=new`) or edit one (`?userId=<id>`); email or copy a set-password
 * link; deactivate, reactivate or delete; and, for superusers, set a password.
 * Choosing a user shows what they changed beside the list (`?historyUserId`).
 * Its search params ride on the URL of the page under the overlay.
 */

import {
  Button,
  Container,
  CopyButton,
  Grid,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import type { ApiManagedUser, NewUserRequest } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { InlineLoading } from 'components/Loading';
import { useCurrentUser } from 'hooks/auth';
import { usePermissions } from 'hooks/permissions';
import { useOverlay } from 'navigation/overlay';
import { useState } from 'react';
import {
  useCopyPasswordLink,
  useCreateUser,
  userHooks,
  useSendPasswordLink,
  useSetUserPassword,
  useUpdateUser,
  useUserHistory,
} from 'store/users';
import { apiErrorMessage } from 'utils/fetch';

import { formatTime } from '../email/emailLabels';
import { SetUserPasswordModal } from './SetUserPasswordModal';
import { UserForm, type UserFormValues } from './UserForm';
import { UserHistoryPanel } from './UserHistoryPanel';
import { UsersTable } from './UsersTable';

function requestFor(values: UserFormValues, isSuperuser: boolean, creating: boolean) {
  const body: NewUserRequest & { is_active?: boolean } = {
    username: values.username.trim(),
    email: values.email.trim(),
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    role: values.role,
  };
  if (isSuperuser) body.django_access = values.django_access;
  if (creating) {
    body.send_password_link = values.passwordMode === 'link';
    if (isSuperuser && values.passwordMode === 'password') {
      body.password = values.password;
      body.require_change = values.require_change;
    }
  } else {
    body.is_active = values.is_active;
  }
  return body;
}

export function UsersPage() {
  const { canManageUsers } = usePermissions();
  const { data: me } = useCurrentUser();
  const { search, setSearch } = useOverlay();
  const { userId, historyUserId } = search;
  const narrow = useMediaQuery('(max-width: 48em)');
  const { data: users } = userHooks.useList(undefined, canManageUsers);
  const historyUser = users?.find((u) => String(u.id) === historyUserId);
  const history = useUserHistory(historyUser?.id);
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = userHooks.useDelete();
  const sendLink = useSendPasswordLink();
  const copyLink = useCopyPasswordLink();
  const setPassword = useSetUserPassword();
  const [settingPasswordFor, setSettingPasswordFor] = useState<ApiManagedUser | null>(null);
  const [copied, setCopied] = useState<{ username: string; url: string; expires: string } | null>(
    null,
  );

  // Hidden from everyone but Admins.
  if (!canManageUsers) return null;

  const isSuperuser = !!me?.is_superuser;
  const editing =
    userId && userId !== 'new' ? users?.find((u) => String(u.id) === userId) : undefined;
  const formOpen = userId === 'new' || !!editing;
  // Each keeps the other: editing doesn't close the history, nor the reverse.
  const openForm = (id?: string) => setSearch({ userId: id });
  const showHistory = (id?: number) => setSearch({ historyUserId: id ? String(id) : undefined });
  const fail = (error: Error) =>
    notifications.show({ color: 'red', message: apiErrorMessage(error) });

  const save = (values: UserFormValues) => {
    const body = requestFor(values, isSuperuser, !editing);
    const done = (message: string) => () => {
      notifications.show({ color: 'green', message });
      openForm(undefined);
    };
    if (editing) update.mutate({ id: editing.id, ...body }, { onSuccess: done('Saved') });
    else
      create.mutate(body, {
        onSuccess: done(
          body.send_password_link
            ? `Added ${body.username}; they’ve been emailed a link to choose a password.`
            : `Added ${body.username}.`,
        ),
      });
  };

  const actions = {
    onShowHistory: (user: ApiManagedUser) => showHistory(user.id),
    onEdit: (user: ApiManagedUser) => openForm(String(user.id)),
    onSendLink: (user: ApiManagedUser) =>
      modals.openConfirmModal({
        title: 'Email a set-password link?',
        children: (
          <Text size="sm">
            {user.username} will get an email at {user.email} with a link to choose a new password.
            Their current password keeps working until they do.
          </Text>
        ),
        labels: { confirm: 'Send', cancel: 'Cancel' },
        onConfirm: () =>
          sendLink.mutate(user.id, {
            onSuccess: (sent) =>
              notifications.show({
                color: 'green',
                message: `Link emailed to ${sent.to}; see how it went in an event’s Email › History.`,
              }),
          }),
      }),
    onCopyLink: (user: ApiManagedUser) =>
      copyLink.mutate(user.id, {
        onSuccess: ({ url, expires_at }) =>
          setCopied({ username: user.username, url, expires: formatTime(expires_at) }),
      }),
    onSetPassword: isSuperuser ? (user: ApiManagedUser) => setSettingPasswordFor(user) : undefined,
    onToggleActive: (user: ApiManagedUser) =>
      update.mutate(
        { id: user.id, is_active: !user.is_active },
        {
          onSuccess: () =>
            notifications.show({
              color: 'green',
              message: `${user.username} is ${user.is_active ? 'deactivated' : 'active again'}.`,
            }),
          onError: fail,
        },
      ),
    onDelete: (user: ApiManagedUser) =>
      confirmDelete({
        path: 'users',
        id: user.id,
        title: 'Delete user',
        message: <>Delete {user.username}? Deactivating keeps their account and history instead.</>,
        onConfirm: () => remove.mutate({ id: user.id }),
      }),
  };

  return (
    <Container size={historyUser ? 'xl' : 'lg'}>
      <Stack>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Everyone who can sign in to the Camphoric admin, and their permission group.
          </Text>
          <Button leftSection={<IconPlus size={16} />} onClick={() => openForm('new')}>
            Add user
          </Button>
        </Group>
        {users ? (
          <Grid>
            <Grid.Col span={{ base: 12, md: historyUser ? 7 : 12 }}>
              <UsersTable
                users={users}
                currentUserId={me?.id ?? null}
                selectedUserId={historyUser?.id}
                {...actions}
              />
            </Grid.Col>
            {historyUser && (
              <Grid.Col span={{ base: 12, md: 5 }}>
                <UserHistoryPanel
                  key={historyUser.id}
                  user={historyUser}
                  entries={history.data?.pages.flatMap((page) => page.results)}
                  total={history.data?.pages[0]?.count}
                  error={history.error ? apiErrorMessage(history.error) : undefined}
                  hasMore={history.hasNextPage}
                  loadingMore={history.isFetchingNextPage}
                  onLoadMore={() => void history.fetchNextPage()}
                  onClose={() => showHistory(undefined)}
                />
              </Grid.Col>
            )}
          </Grid>
        ) : (
          <InlineLoading message="Loading users…" />
        )}
      </Stack>

      <Modal
        opened={formOpen}
        onClose={() => openForm(undefined)}
        title={editing ? `Edit ${editing.username}` : 'Add a user'}
        size="lg"
        fullScreen={narrow}
      >
        {formOpen && (
          <UserForm
            key={userId}
            user={editing}
            isSelf={!!editing && editing.id === me?.id}
            isSuperuser={isSuperuser}
            saving={create.isPending || update.isPending}
            error={editing ? update.error : create.error}
            onSubmit={save}
            onCancel={() => openForm(undefined)}
          />
        )}
      </Modal>

      <SetUserPasswordModal
        username={settingPasswordFor?.username ?? null}
        saving={setPassword.isPending}
        error={setPassword.error}
        onClose={() => {
          setPassword.reset();
          setSettingPasswordFor(null);
        }}
        onSubmit={(password, requireChange) =>
          settingPasswordFor &&
          setPassword.mutate(
            { userId: settingPasswordFor.id, password, requireChange },
            {
              onSuccess: () => {
                notifications.show({
                  color: 'green',
                  message: `${settingPasswordFor.username}’s password is set.`,
                });
                setSettingPasswordFor(null);
              },
            },
          )
        }
      />

      <Modal opened={copied !== null} onClose={() => setCopied(null)} title="Set-password link">
        {copied && (
          <Stack>
            <Text size="sm">
              Give this link to {copied.username} yourself. It works once, until {copied.expires}.
            </Text>
            <Group wrap="nowrap" gap="xs">
              <TextInput value={copied.url} readOnly style={{ flex: 1 }} aria-label="Link" />
              <CopyButton value={copied.url}>
                {({ copied: done, copy }) => (
                  <Button variant="light" onClick={copy}>
                    {done ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
