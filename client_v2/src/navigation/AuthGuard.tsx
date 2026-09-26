/**
 * Gate for the admin surface (SPEC §4, §6). Requires an authenticated user
 * (non-empty username); otherwise renders the Login form in place. A signed-in
 * user without a Camphoric permission group sees the no-access screen. While
 * authenticated it runs proactive session monitoring (DR-26).
 *
 * The server enforces each role's permissions (DR-50); the admin hides what the
 * role can't do (DR-51) and handles any 403 it still meets gracefully.
 */

import { FullScreenLoading } from 'components/Loading';
import { isAuthenticated, useCurrentUser } from 'hooks/auth';
import { useSessionMonitor } from 'hooks/useSessionMonitor';
import { Login } from 'navigation/Login';
import { NoAccess } from 'navigation/NoAccess';
import type { ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: user, isLoading } = useCurrentUser();
  const authed = isAuthenticated(user);

  useSessionMonitor(authed);

  if (isLoading && user === undefined) {
    return <FullScreenLoading message="Checking your session…" />;
  }

  if (!authed) {
    return <Login />;
  }

  if (!user?.role) {
    return <NoAccess user={user!} />;
  }

  return <>{children}</>;
}
