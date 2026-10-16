/**
 * The record an open editor shows, from a list (SPEC §9.8): the list's copy
 * while it's there, else the last one seen — someone else deleted it while it
 * was open. The editor then stays, with any unsaved changes still in it,
 * until the user closes it; `deleted` says so (show `RecordDeleted`). Closing
 * it (no `id`) forgets it.
 */

import type { Scalar } from 'api-types';
import { useState } from 'react';

export function useKeptRecord<R extends { id: Scalar; version?: number }>(
  /** The open record's id; undefined while none is open. */
  id: string | undefined,
  /** It, as the list has it now. */
  found: R | undefined,
): { record: R | undefined; deleted: boolean } {
  const [last, setLast] = useState(found);
  // Remember each version the list has, and forget it once it's no longer the
  // one open (state derived during render, not after).
  if (found) {
    if (found.id !== last?.id || found.version !== last.version) setLast(found);
  } else if (last && String(last.id) !== id) setLast(undefined);
  const kept = !found && last && String(last.id) === id ? last : undefined;
  return { record: found ?? kept, deleted: !!kept };
}
