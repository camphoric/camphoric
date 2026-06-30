/**
 * The current event id within the registration flow. Read strictly from the
 * register layout route (which owns `$eventId`), so the value is a non-optional
 * string — no cast needed in the step components.
 */

import { useParams } from '@tanstack/react-router';

export function useEventId(): string {
  return useParams({ from: '/events/$eventId/register' }).eventId;
}
