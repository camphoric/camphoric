/**
 * Who's signed in and their Camphoric permission group (SPEC §6, §8.2), with the
 * account actions: Users (Admins), change password, sign out.
 */

import { Badge, Button, Group, Menu, Text } from '@mantine/core';
import { IconChevronDown, IconKey, IconLogout, IconUsers } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useCurrentUser, useLogout } from 'hooks/auth';
import { ROLE_LABEL, usePermissions } from 'hooks/permissions';
import { ChangePasswordModal } from 'pages/account/ChangePasswordModal';
import { useState } from 'react';

export function UserMenu() {
  const { data: user } = useCurrentUser();
  const { canManageUsers } = usePermissions();
  const logout = useLogout();
  const [changing, setChanging] = useState(false);
  if (!user?.username) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Button variant="subtle" size="xs" rightSection={<IconChevronDown size={14} />}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" truncate maw={160}>
                {name}
              </Text>
              {user.role && (
                <Badge size="xs" variant="light" visibleFrom="xs">
                  {ROLE_LABEL[user.role]}
                </Badge>
              )}
            </Group>
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            {user.username}
            {user.role ? ` · ${ROLE_LABEL[user.role]}` : ''}
          </Menu.Label>
          {canManageUsers && (
            <Menu.Item component={Link} to="/admin/users" leftSection={<IconUsers size={16} />}>
              Users
            </Menu.Item>
          )}
          <Menu.Item leftSection={<IconKey size={16} />} onClick={() => setChanging(true)}>
            Change password
          </Menu.Item>
          <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => logout.mutate()}>
            Sign out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <ChangePasswordModal opened={changing} onClose={() => setChanging(false)} />
    </>
  );
}
