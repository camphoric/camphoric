/**
 * User management for Admins (SPEC §8.10; §15 DR-50, DR-52): the users list,
 * editing and deleting (`userHooks`), creating, emailing or copying a
 * set-password link, and — superusers only — setting a password.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiManagedUser, NewUserRequest } from 'api-types';
import { apiFetch } from 'utils/fetch';

import { createEntityHooks } from './createEntityHooks';

export const userHooks = createEntityHooks<ApiManagedUser>({ name: 'User', path: 'users' });

function useInvalidateUsers() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [userHooks.name] });
}

/** Create a user (form errors are shown inline). */
export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: NewUserRequest) =>
      apiFetch<ApiManagedUser>('/api/users/', { method: 'POST', body }),
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}

/** Save changes to a user (form errors are shown inline). */
export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<NewUserRequest> & { id: number; is_active?: boolean }) =>
      apiFetch<ApiManagedUser>(`/api/users/${id}/`, { method: 'PATCH', body }),
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}

export interface PasswordLinkSent {
  to: string;
  status: string;
  last_error: string;
}

/** Email the user a set-password link. */
export function useSendPasswordLink() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      apiFetch<PasswordLinkSent>(`/api/users/${userId}/send-password-link/`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['EmailMessage'] }),
  });
}

/** A set-password link to hand over yourself. */
export function useCopyPasswordLink() {
  return useMutation({
    mutationFn: (userId: number) =>
      apiFetch<{ url: string; expires_at: string }>(`/api/users/${userId}/password-link/`, {
        method: 'POST',
      }),
  });
}

/** Superusers: set a user's password, to be changed at their next sign-in if asked. */
export function useSetUserPassword() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({
      userId,
      password,
      requireChange,
    }: {
      userId: number;
      password: string;
      requireChange: boolean;
    }) =>
      apiFetch<void>(`/api/users/${userId}/set-password/`, {
        method: 'POST',
        body: { password, require_change: requireChange },
      }),
    meta: { suppressErrorNotification: true },
    onSuccess: invalidate,
  });
}
