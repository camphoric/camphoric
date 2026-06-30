/**
 * The admin surface entry (SPEC §4, §11). Wraps the admin outlet in the auth
 * guard. Extracted into its own module so the whole admin application — and its
 * heavy, admin-only dependencies — can be lazy-loaded behind `/admin` and kept
 * out of the registration entry bundle.
 */

import { Outlet } from '@tanstack/react-router';
import { AuthGuard } from 'navigation/AuthGuard';

export function AdminShell() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}
