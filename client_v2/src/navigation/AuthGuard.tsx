/**
 * Gate for the admin surface (SPEC §4, §6). Requires an authenticated user
 * (non-empty username); otherwise renders the Login form in place. While
 * authenticated it runs proactive session monitoring (DR-26).
 *
 * Per-object/org authorization is the server's job — the UI renders what the API
 * returns and handles 403s gracefully (DR-12).
 */

import { FullScreenLoading } from 'components/Loading';
import { isAuthenticated, useCurrentUser } from 'hooks/auth';
import { useSessionMonitor } from 'hooks/useSessionMonitor';
import { Login } from 'navigation/Login';
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

  return <>{children}</>;
}
