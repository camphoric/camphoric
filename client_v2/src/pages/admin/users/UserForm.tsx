/**
 * Create or edit a user (SPEC §8.10; §15 DR-50, DR-52): username, name, email,
 * their Camphoric permission group and whether they're active. Only superusers
 * see Django access (Regular user, or Staff / Superuser for developers). A new
 * user gets an emailed set-password link by default; a superuser can instead
 * set a password now, to be changed at the next sign-in. Nobody changes their
 * own group, Django access or active state.
 */

import {
  Alert,
  Button,
  Checkbox,
  Group,
  PasswordInput,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import type { ApiManagedUser, DjangoAccess, Role } from 'api-types';
import { useState } from 'react';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

import { DJANGO_ACCESS_LABEL, GROUP_OPTIONS } from './userLabels';

export type PasswordMode = 'link' | 'password' | 'none';

export interface UserFormValues {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role | null;
  django_access: DjangoAccess;
  is_active: boolean;
  /** New users: how they get a password. */
  passwordMode: PasswordMode;
  password: string;
  require_change: boolean;
}

export interface UserFormProps {
  /** Omitted for a new user. */
  user?: ApiManagedUser;
  /** Editing your own account. */
  isSelf?: boolean;
  /** The signed-in user is a superuser (sees Django access, can set passwords). */
  isSuperuser?: boolean;
  saving?: boolean;
  /** The last save's error: field errors show under their fields. */
  error?: unknown;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}

export function UserForm({
  user,
  isSelf = false,
  isSuperuser = false,
  saving,
  error,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [values, setValues] = useState<UserFormValues>(() => ({
    username: user?.username ?? '',
    email: user?.email ?? '',
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    role: user ? user.role : 'reporter',
    django_access: user?.django_access ?? 'regular',
    is_active: user?.is_active ?? true,
    passwordMode: 'link',
    password: '',
    require_change: true,
  }));
  const [again, setAgain] = useState('');
  const set = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const errors = apiFieldErrors(error);
  const otherError = error && !Object.keys(errors).length ? apiErrorMessage(error) : null;
  const superuser = values.django_access === 'superuser';
  const settingPassword = !user && values.passwordMode === 'password';
  const mismatch = settingPassword && again !== '' && again !== values.password;
  const ready =
    values.username.trim() !== '' &&
    values.email.trim() !== '' &&
    (!settingPassword || (values.password !== '' && values.password === again));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit(values);
      }}
    >
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Username"
            withAsterisk
            value={values.username}
            onChange={(e) => set('username', e.currentTarget.value)}
            error={errors.username}
          />
          <TextInput
            label="Email"
            type="email"
            withAsterisk
            value={values.email}
            onChange={(e) => set('email', e.currentTarget.value)}
            error={errors.email}
          />
          <TextInput
            label="First name"
            value={values.first_name}
            onChange={(e) => set('first_name', e.currentTarget.value)}
          />
          <TextInput
            label="Last name"
            value={values.last_name}
            onChange={(e) => set('last_name', e.currentTarget.value)}
          />
        </SimpleGrid>

        <Select
          label="Camphoric permission group"
          description={
            isSelf
              ? 'You can’t change your own group.'
              : superuser
                ? 'A superuser is always an Admin.'
                : undefined
          }
          data={GROUP_OPTIONS}
          value={superuser ? 'admin' : (values.role ?? 'none')}
          onChange={(value) => set('role', !value || value === 'none' ? null : (value as Role))}
          allowDeselect={false}
          disabled={isSelf || superuser}
          error={errors.role}
        />

        {isSuperuser && (
          <Select
            label="Django access"
            description="Access to Django’s own admin site. Most users need none."
            data={(Object.keys(DJANGO_ACCESS_LABEL) as DjangoAccess[]).map((value) => ({
              value,
              label: DJANGO_ACCESS_LABEL[value],
            }))}
            value={values.django_access}
            onChange={(value) => set('django_access', (value ?? 'regular') as DjangoAccess)}
            allowDeselect={false}
            disabled={isSelf}
            error={errors.django_access}
          />
        )}

        {user && !isSelf && (
          <Switch
            label="Active (can sign in)"
            checked={values.is_active}
            onChange={(e) => set('is_active', e.currentTarget.checked)}
          />
        )}

        {!user &&
          (isSuperuser ? (
            <Radio.Group
              label="How they get a password"
              value={values.passwordMode}
              onChange={(value) => set('passwordMode', value as PasswordMode)}
            >
              <Stack gap={6} mt={4}>
                <Radio value="link" label="Email them a link to choose a password" />
                <Radio value="password" label="Set a password now" />
                <Radio value="none" label="Neither for now" />
              </Stack>
            </Radio.Group>
          ) : (
            <Checkbox
              label="Email them a link to choose a password"
              checked={values.passwordMode === 'link'}
              onChange={(e) => set('passwordMode', e.currentTarget.checked ? 'link' : 'none')}
            />
          ))}

        {settingPassword && (
          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <PasswordInput
                label="Password"
                autoComplete="new-password"
                value={values.password}
                onChange={(e) => set('password', e.currentTarget.value)}
                error={errors.password}
              />
              <PasswordInput
                label="Password again"
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.currentTarget.value)}
                error={mismatch ? 'The passwords don’t match.' : undefined}
              />
            </SimpleGrid>
            <Checkbox
              label="Require a password change at next sign-in"
              checked={values.require_change}
              onChange={(e) => set('require_change', e.currentTarget.checked)}
            />
          </Stack>
        )}

        {otherError && (
          <Alert color="red" variant="light">
            {otherError}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} loading={saving}>
            {user ? 'Save' : 'Add user'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
