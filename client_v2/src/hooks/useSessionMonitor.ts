/**
 * Proactive admin session monitoring (SPEC §6, DR-26). Rather than waiting for a
 * request to fail, re-validate the session against the whoami endpoint on window
 * focus, on throttled user activity, and on a regular interval. That traffic
 * also acts as keep-alive (the backend slides the session expiry on each
 * request), so an actively-working admin stays logged in.
 *
 * The reactive 401-bounce-to-login (DR-9) remains the backstop. The public
 * registration flow is anonymous and does not use this.
 */

import { useThrottledCallback, useWindowEvent } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { WHOAMI_KEY } from 'hooks/auth';
import { useEffect } from 'react';

const INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes
const ACTIVITY_THROTTLE_MS = 60 * 1000; // at most once a minute from activity

export function useSessionMonitor(enabled: boolean) {
  const client = useQueryClient();

  const refresh = useThrottledCallback(() => {
    if (!enabled) return;
    void client.invalidateQueries({ queryKey: WHOAMI_KEY });
  }, ACTIVITY_THROTTLE_MS);

  useWindowEvent('focus', refresh);
  useWindowEvent('pointerdown', refresh);
  useWindowEvent('keydown', refresh);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(refresh, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);
}
