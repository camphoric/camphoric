/**
 * The users list (SPEC §8.10): each user's name and email, Camphoric permission
 * group, Django access (when it's more than a regular user's), whether they're
 * active and have a password, and when they last signed in — with a menu of
 * what an Admin can do to them. Your own row can't be deactivated or deleted.
 * Choosing a row (or "Change history" in its menu) shows what that user changed.
 */

import { ActionIcon, Badge, Group, Menu, Table, Text } from '@mantine/core';
import {
  IconCopy,
  IconDots,
  IconHistory,
  IconKey,
  IconMail,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react';
import type { ApiManagedUser } from 'api-types';

import { formatTime } from '../email/emailLabels';
import { DJANGO_ACCESS_LABEL, groupLabel } from './userLabels';

export interface UserActions {
  onShowHistory: (user: ApiManagedUser) => void;
  onEdit: (user: ApiManagedUser) => void;
  onSendLink: (user: ApiManagedUser) => void;
  onCopyLink: (user: ApiManagedUser) => void;
  /** Superusers only: omit it to leave the action out. */
  onSetPassword?: (user: ApiManagedUser) => void;
  onToggleActive: (user: ApiManagedUser) => void;
  onDelete: (user: ApiManagedUser) => void;
}

interface UsersTableProps extends UserActions {
  users: ApiManagedUser[];
  /** The signed-in Admin. */
  currentUserId: number | null;
  /** Whose history is shown, if anyone's. */
  selectedUserId?: number;
}

export function fullName(user: Pick<ApiManagedUser, 'first_name' | 'last_name'>) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ');
}

export function UsersTable({ users, currentUserId, selectedUserId, ...actions }: UsersTableProps) {
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Camphoric permission group</Table.Th>
            <Table.Th>Last signed in</Table.Th>
            <Table.Th aria-label="Actions" />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((user) => {
            const self = user.id === currentUserId;
            const selected = user.id === selectedUserId;
            return (
              <Table.Tr
                key={user.id}
                opacity={user.is_active ? 1 : 0.6}
                aria-selected={selected}
                bg={selected ? 'var(--mantine-primary-color-light)' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => actions.onShowHistory(user)}
              >
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {user.username}
                    {self && ' (you)'}
                  </Text>
                  {fullName(user) && (
                    <Text size="xs" c="dimmed">
                      {fullName(user)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Badge variant="light" color={user.role ? 'blue' : 'gray'}>
                      {groupLabel(user.role)}
                    </Badge>
                    {user.django_access && user.django_access !== 'regular' && (
                      <Badge variant="outline" color="grape">
                        {DJANGO_ACCESS_LABEL[user.django_access]}
                      </Badge>
                    )}
                    {!user.is_active && <Badge color="gray">Deactivated</Badge>}
                    {!user.has_password && (
                      <Badge variant="light" color="yellow">
                        No password yet
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>{user.last_login ? formatTime(user.last_login) : 'Never'}</Table.Td>
                {/* The menu's own clicks aren't a choice of the row. */}
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" aria-label={`Actions for ${user.username}`}>
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconHistory size={16} />}
                        onClick={() => actions.onShowHistory(user)}
                      >
                        Change history
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconPencil size={16} />}
                        onClick={() => actions.onEdit(user)}
                      >
                        Edit
                      </Menu.Item>
                      {user.is_active && (
                        <>
                          <Menu.Item
                            leftSection={<IconMail size={16} />}
                            onClick={() => actions.onSendLink(user)}
                          >
                            Email a set-password link
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconCopy size={16} />}
                            onClick={() => actions.onCopyLink(user)}
                          >
                            Copy a set-password link
                          </Menu.Item>
                        </>
                      )}
                      {actions.onSetPassword && !self && (
                        <Menu.Item
                          leftSection={<IconKey size={16} />}
                          onClick={() => actions.onSetPassword!(user)}
                        >
                          Set password
                        </Menu.Item>
                      )}
                      {!self && (
                        <>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={
                              user.is_active ? (
                                <IconPlayerPause size={16} />
                              ) : (
                                <IconPlayerPlay size={16} />
                              )
                            }
                            onClick={() => actions.onToggleActive(user)}
                          >
                            {user.is_active ? 'Deactivate' : 'Reactivate'}
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => actions.onDelete(user)}
                          >
                            Delete
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
