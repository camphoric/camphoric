/**
 * The admin surface entry (SPEC §4, §11). Wraps the admin outlet in the auth
 * guard, provides the signed-in user's permissions (DR-51), and hosts the
 * overlays that open over any admin page (Users, DR-84). Extracted into its own module so the whole admin application — and its
 * heavy, admin-only dependencies — can be lazy-loaded behind `/admin` and kept
 * out of the registration entry bundle.
 */

import { Outlet } from '@tanstack/react-router';
import { useCurrentUser } from 'hooks/auth';
import { PermissionsProvider } from 'hooks/permissions';
import { AuthGuard } from 'navigation/AuthGuard';
import { UsersOverlay } from 'pages/admin/users/UsersOverlay';
import type { ReactNode } from 'react';

export function AdminShell() {
  return (
    <AuthGuard>
      <AdminPermissions>
        <Outlet />
        <UsersOverlay />
      </AdminPermissions>
    </AuthGuard>
  );
}

/** Inside the guard, so a lapsed session keeps the user's permissions until
 * they sign back in (DR-127). */
function AdminPermissions({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  return <PermissionsProvider userRole={user?.role ?? null}>{children}</PermissionsProvider>;
}
