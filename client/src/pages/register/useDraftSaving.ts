/**
 * Saves the form to the server as it's filled in (SPEC §7.1; §15, DR-140), so a
 * registrar can help someone who seems stalled. A changed field saves as it loses
 * focus, not on each keystroke, at most once in `SAVE_INTERVAL_MS`; a change held
 * back by that is sent when the page is hidden. Nothing goes until someone has
 * touched the form and something has changed since: the form reports its schema's
 * defaults as a change as it loads, and opening the page must leave no record, nor
 * count as activity on a draft it comes back to. The first save starts the draft,
 * and its uuid is kept beside the form data. A failed save never interrupts the
 * form: the change waits for the next chance, and a 429 or 503 backs off.
 */

import type { ApiRegister } from 'api-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRegistrationStore } from 'store/registration';
import { saveDraft } from 'store/registrationApi';
import { ApiError } from 'utils/fetch';

import { loadDraftUUID, saveDraftUUID } from './storage';

export const SAVE_INTERVAL_MS = 30_000;
export const FIRST_BACKOFF_MS = 60_000;
export const MAX_BACKOFF_MS = 10 * 60_000;

export function useDraftSaving(
  eventId: string,
  storageKey: string,
  invitation: ApiRegister['invitation'],
) {
  const state = useRef({
    touched: false,
    changed: false,
    sending: false,
    /** Settles once the save under way, if any, has. */
    settled: Promise.resolve(),
    paused: false,
    nextSaveAt: 0,
    backedOffUntil: 0,
    backoff: 0,
  });

  const send = useCallback(
    (keepalive: boolean) => {
      const saving = state.current;
      if (!storageKey || !saving.changed || saving.sending || saving.paused) return;
      if (Date.now() < saving.backedOffUntil) return;
      saving.changed = false;
      saving.sending = true;
      saving.nextSaveAt = Date.now() + SAVE_INTERVAL_MS;
      const uuid = loadDraftUUID(storageKey);
      saving.settled = saveDraft(
        eventId,
        {
          formData: useRegistrationStore.getState().registration,
          ...(uuid ? { uuid } : {}),
          ...(invitation ? { invitation } : {}),
        },
        keepalive,
      )
        .then((draft) => {
          saving.backoff = 0;
          saveDraftUUID(storageKey, draft.uuid);
        })
        .catch((error: unknown) => {
          saving.changed = true;
          if (!(error instanceof ApiError) || ![429, 503].includes(error.status)) return;
          saving.backoff = Math.min((saving.backoff || FIRST_BACKOFF_MS / 2) * 2, MAX_BACKOFF_MS);
          const asked = (error.retryAfter ?? 0) * 1000;
          saving.backedOffUntil = Date.now() + Math.max(saving.backoff, asked);
        })
        .finally(() => {
          saving.sending = false;
        });
    },
    [eventId, storageKey, invitation],
  );

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') send(true);
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [send]);

  return useMemo(
    () => ({
      /** Someone has come to the form: what changes from now on is theirs. */
      fieldFocused: () => {
        state.current.touched = true;
      },
      /** Something in the form changed. */
      changed: () => {
        if (state.current.touched) state.current.changed = true;
      },
      /** A field lost focus: save, unless one went out too recently. */
      fieldBlurred: () => {
        if (Date.now() >= state.current.nextSaveAt) send(false);
      },
      /**
       * The form is being submitted, which saves it: nothing more until that's settled.
       * Resolves once any save under way has, so what's submitted names its draft.
       */
      pause: () => {
        state.current.paused = true;
        state.current.changed = false;
        return state.current.settled;
      },
      /** Submitting failed: go on saving. */
      resume: () => {
        state.current.paused = false;
        state.current.changed = true;
      },
      /** Starting again: forget what was held. Resolves once any save under way has settled. */
      stop: () => {
        state.current.changed = false;
        state.current.touched = false;
        return state.current.settled;
      },
    }),
    [send],
  );
}
