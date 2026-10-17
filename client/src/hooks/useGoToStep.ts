/**
 * Navigate between registration steps (SPEC §7) without repeating the route path
 * and `eventId` params at each call site. The query string goes along: it may
 * carry an invitation code, and the register config is fetched (and keyed) by it.
 */

import { useNavigate } from '@tanstack/react-router';
import { useEventId } from 'hooks/useEventId';
import { useCallback } from 'react';

export type RegisterStep = 'registration' | 'payment' | 'finished';

const ROUTES = {
  registration: '/events/$eventId/register/registration',
  payment: '/events/$eventId/register/payment',
  finished: '/events/$eventId/register/finished',
} as const;

export function useGoToStep() {
  const navigate = useNavigate();
  const eventId = useEventId();
  return useCallback(
    (step: RegisterStep) => void navigate({ to: ROUTES[step], params: { eventId }, search: true }),
    [navigate, eventId],
  );
}
