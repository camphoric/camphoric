/**
 * The edit lease on a record a form edits (SPEC §9.8; §15, DR-110).
 *
 * - While the form has unsaved changes, or after the user chose to edit a
 *   record someone else held, this tab holds the record's lease, renewing it
 *   every half minute. Once the changes are saved or dropped, or the form
 *   closes (the page included), it gives it up — even one still being taken.
 * - Someone else's lease shows: with no unsaved changes here the form is
 *   view-only until their lease ends (looked at every 15 seconds; the record
 *   is then fetched afresh, with whatever they saved), or until the user takes
 *   it over. With unsaved changes here (they took it over, or started first)
 *   the form stays editable: the version check still keeps anyone's save from
 *   going over another's unseen (DR-109).
 *
 * Only users who can change data take leases.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ApiEditLease, Scalar } from 'api-types';
import { usePermissions } from 'hooks/permissions';
import { useEffect, useRef, useState } from 'react';
import { CLIENT_ID, leaseKey, releaseLease, takeLease, useRecordLease } from 'store/leases';
import { ENTITY_OF_MODEL } from 'store/liveModels';
import { ApiError } from 'utils/fetch';

const RENEW_MS = 30_000;

export interface EditLeaseState {
  /** Someone else's lease on the record (another person, or another tab). */
  other: ApiEditLease | null;
  /** Someone else is editing and this form has nothing unsaved: show it, don't edit it. */
  viewOnly: boolean;
  /** Someone else holds it while this form has unsaved changes. */
  overlapping: boolean;
  /** Take the lease from whoever holds it. */
  takeOver: () => Promise<void>;
}

/** The holder's lease, when a take was refused because someone else has it. */
function heldBy(error: unknown): ApiEditLease | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { code?: unknown; lease?: ApiEditLease } | null;
  return body?.code === 'lease_held' && body.lease ? body.lease : null;
}

export function useEditLease(
  model: string | undefined,
  id: Scalar,
  isDirty: boolean,
): EditLeaseState {
  const client = useQueryClient();
  const { canEdit } = usePermissions();
  const { data } = useRecordLease(model, id);
  // This tab's lease, while it holds one.
  const held = useRef<number | null>(null);
  // Someone else's lease, found when taking ours was refused.
  const [refused, setRefused] = useState<ApiEditLease | null>(null);
  // The user chose to edit a record someone else held.
  const [tookOver, setTookOver] = useState(false);

  const wantsLease = !!model && canEdit && (isDirty || tookOver) && !refused;
  // Whether a take that comes back now is still wanted.
  const wanted = useRef(wantsLease);
  wanted.current = wantsLease;

  const take = async (takeover = false) => {
    if (!model) return;
    try {
      const lease = await takeLease(model, id, takeover);
      if (!takeover && !wanted.current) {
        // Saved, dropped or closed while it was on its way.
        void releaseLease(lease.id);
        return;
      }
      held.current = lease.id;
      setRefused(null);
      if (takeover) setTookOver(true);
      client.setQueryData(leaseKey(model, id), lease);
    } catch (error) {
      const theirs = heldBy(error);
      if (!theirs) return; // a blip: the next renewal tries again
      held.current = null;
      setRefused(theirs);
      setTookOver(false);
      client.setQueryData(leaseKey(model, id), theirs);
    }
  };

  const release = () => {
    if (held.current === null || !model) return;
    void releaseLease(held.current);
    held.current = null;
    client.setQueryData(leaseKey(model, id), null);
  };

  const other = (data && data.client_id !== CLIENT_ID ? data : null) ?? refused;

  // Their lease has ended: this tab may hold it again…
  useEffect(() => {
    if (data === null) setRefused(null);
  }, [data]);

  // …and the record is fetched afresh, with whatever they saved.
  const hadOther = useRef(false);
  useEffect(() => {
    if (hadOther.current && !other && model && ENTITY_OF_MODEL[model]) {
      void client.invalidateQueries({ queryKey: [ENTITY_OF_MODEL[model]] });
    }
    hadOther.current = !!other;
  }, [other, model, client]);

  useEffect(() => {
    if (!wantsLease) return;
    void take();
    const timer = setInterval(() => void take(), RENEW_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsLease, model, id]);

  // Saved or dropped: let it go. (Becoming unsaved again takes it anew.)
  const wasDirty = useRef(isDirty);
  useEffect(() => {
    if (wasDirty.current && !isDirty) {
      setTookOver(false);
      release();
    }
    wasDirty.current = isDirty;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  // Closing the form, or the page.
  useEffect(() => {
    const onPageHide = () => {
      if (held.current !== null) void releaseLease(held.current, true);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      wanted.current = false;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, id]);

  return {
    other,
    viewOnly: !!other && !isDirty,
    overlapping: !!other && isDirty,
    takeOver: () => take(true),
  };
}
