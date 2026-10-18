/**
 * Gate for the admin surface (SPEC §4, §6). Requires an authenticated user
 * (non-empty username); otherwise renders the Login form in place. A user whose
 * password must be changed is asked to change it first (DR-52); a signed-in
 * user without a Camphoric permission group sees the no-access screen. While
 * authenticated it runs proactive session monitoring (DR-26).
 *
 * Once the admin has been shown, a session that ends doesn't take it away: it
 * stays mounted, out of reach, under a prompt to sign in again, so signing back
 * in as the same user carries on with any unsaved edits. Underneath, the
 * current user is still the one whose admin it is. Signing in as someone else
 * starts the admin afresh, and signing out on purpose (in any tab) returns to
 * the sign-in page (DR-127).
 *
 * The server enforces each role's permissions (DR-50); the admin hides what the
 * role can't do (DR-51) and handles any 403 it still meets gracefully.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ApiUser } from 'api-types';
import { FullScreenLoading } from 'components/Loading';
import {
  AdminUserContext,
  isAuthenticated,
  SignedOutContext,
  useCurrentUser,
  WHOAMI_KEY,
} from 'hooks/auth';
import { useSessionMonitor } from 'hooks/useSessionMonitor';
import { Login, SignInAgain } from 'navigation/Login';
import { MustChangePassword } from 'navigation/MustChangePassword';
import { NoAccess } from 'navigation/NoAccess';
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/** Tells the admin's other tabs that the user signed out on purpose. */
const SIGNED_OUT_CHANNEL = 'camphoric-signed-out';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const client = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();
  const authed = isAuthenticated(user);
  const admitted = authed && !user?.must_change_password && !!user?.role;
  // Whose admin is mounted. It outlives their session; another screen in its
  // place, or signing out on purpose, ends it.
  const [holder, setHolder] = useState<ApiUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useSessionMonitor(authed);

  // A sign-out here, or in another tab, is on purpose.
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const tabs = new BroadcastChannel(SIGNED_OUT_CHANNEL);
    tabs.onmessage = () => {
      setSigningOut(true);
      void client.invalidateQueries({ queryKey: WHOAMI_KEY });
    };
    channel.current = tabs;
    return () => {
      tabs.close();
      channel.current = null;
    };
  }, [client]);
  const signedOut = useCallback(() => {
    setSigningOut(true);
    channel.current?.postMessage('signed-out');
  }, []);

  // Settle who holds the admin for this render (React re-renders straight away
  // with the new state). It's keyed by user below, so someone else signing in
  // starts it afresh.
  let mounted = holder;
  if (admitted && user) {
    mounted = user;
  } else if (authed || (signingOut && user !== undefined)) {
    mounted = null;
  }
  if (mounted !== holder) setHolder(mounted);
  if (signingOut && !authed && user !== undefined) setSigningOut(false);

  // Signed in, then the session ended (not while it's still being checked).
  const lost = mounted !== null && !authed && user !== undefined;

  // Back in: reload what failed or went stale while signed out.
  const wasLost = useRef(false);
  useEffect(() => {
    if (lost) {
      wasLost.current = true;
    } else if (admitted && wasLost.current) {
      wasLost.current = false;
      void client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== WHOAMI_KEY[0] });
    }
  }, [lost, admitted, client]);

  return (
    <SignedOutContext.Provider value={signedOut}>
      {mounted ? (
        <>
          <AdminUserContext.Provider value={mounted}>
            <Fragment key={mounted.id}>{children}</Fragment>
          </AdminUserContext.Provider>
          {lost && <SignInAgain username={mounted.username} />}
        </>
      ) : (
        <Gate user={user} checking={isLoading && user === undefined} />
      )}
    </SignedOutContext.Provider>
  );
}

/** What shows in place of the admin. */
function Gate({ user, checking }: { user: ApiUser | undefined; checking: boolean }) {
  if (checking) {
    return <FullScreenLoading message="Checking your session…" />;
  }

  if (!isAuthenticated(user)) {
    return <Login />;
  }

  if (user?.must_change_password) {
    return <MustChangePassword user={user} />;
  }

  return <NoAccess user={user!} />;
}
