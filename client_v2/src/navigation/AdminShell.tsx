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

export function AdminShell() {
  const { data: user } = useCurrentUser();
  return (
    <AuthGuard>
      <PermissionsProvider userRole={user?.role ?? null}>
        <Outlet />
        <UsersOverlay />
      </PermissionsProvider>
    </AuthGuard>
  );
}
