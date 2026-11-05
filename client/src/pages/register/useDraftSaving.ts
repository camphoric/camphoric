/**
 * Saves the form to the server as it's filled in (SPEC §7.1; §15, DR-140), so a
 * registrar can help someone who seems stalled. A changed field saves as it loses
 * focus, not on each keystroke, at most once in `SAVE_INTERVAL_MS`; a change held
 * back by that is sent when the page is hidden. Nothing goes until someone has
 * touched the form and something has changed since: the form reports its schema's
 * defaults as a change as it loads, and opening the page must leave no record, nor
 * count as activity on a draft it comes back to. The first save starts the draft,
 * under a uuid chosen here and kept beside the form data before it goes, so a save
 * whose answer is lost as the page closes still names it. A failed save never
 * interrupts the form: the change waits for the next chance, and a 429 or 503 backs
 * off. A change made while a save is on its way goes as it's done if the page has
 * been hidden meanwhile. It's off while a registration already sent is on offer:
 * what was sent stands until the form is sent again, and the server takes no save
 * of a sent draft but one that reopens it, from a page sent back to the form
 * because its lodging filled up. Sending the form, or starting
 * again, waits for a save under way only so long: an answer that comes later
 * changes nothing here, and a draft it brought back after starting again, or
 * started under another uuid, is discarded.
 */

import type { ApiRegister } from 'api-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRegistrationStore } from 'store/registration';
import { discardDraft, saveDraft } from 'store/registrationApi';
import { ApiError } from 'utils/fetch';

import { loadDraftUUID, saveDraftUUID } from './storage';

export const SAVE_INTERVAL_MS = 30_000;
export const FIRST_BACKOFF_MS = 60_000;
export const MAX_BACKOFF_MS = 10 * 60_000;
/** How long sending the form waits for a save under way: a save never holds up the form. */
export const SETTLE_WAIT_MS = 3_000;

type GivenUpBy = 'sending' | 'starting again';

/** A uuid for a new draft, where the page may make one (only a secure page may). */
const chosenUUID = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;

/** Resolves once any save under way has settled, or it's been given up on. */
const orTimeout = (
  saving: { settled: Promise<void>; overdue: GivenUpBy | null },
  givenUpBy: GivenUpBy,
) =>
  new Promise<void>((resolve) => {
    const giveUp = setTimeout(() => {
      saving.overdue = givenUpBy;
      resolve();
    }, SETTLE_WAIT_MS);
    void saving.settled.then(() => {
      clearTimeout(giveUp);
      resolve();
    });
  });

export function useDraftSaving(
  eventId: string,
  storageKey: string,
  invitation: ApiRegister['invitation'],
  enabled: boolean,
) {
  const state = useRef({
    touched: false,
    changed: false,
    sending: false,
    /** Settles once the save under way, if any, has. */
    settled: Promise.resolve(),
    /** That save was given up on, and by what: it no longer waits for it. */
    overdue: null as GivenUpBy | null,
    paused: false,
    nextSaveAt: 0,
    backedOffUntil: 0,
    backoff: 0,
  });

  const send = useCallback(
    function send(keepalive: boolean) {
      const saving = state.current;
      if (!enabled || !storageKey) return;
      if (!saving.changed || saving.sending || saving.paused) return;
      if (Date.now() < saving.backedOffUntil) return;
      saving.changed = false;
      saving.sending = true;
      saving.nextSaveAt = Date.now() + SAVE_INTERVAL_MS;
      let uuid = loadDraftUUID(storageKey);
      if (!uuid) {
        uuid = chosenUUID();
        if (uuid) saveDraftUUID(storageKey, uuid);
      }
      let saved = false;
      const { registration, lodgingProblem } = useRegistrationStore.getState();
      saving.settled = saveDraft(
        eventId,
        {
          formData: registration,
          ...(uuid ? { uuid } : {}),
          ...(invitation ? { invitation } : {}),
          ...(lodgingProblem ? { reopen: true as const } : {}),
        },
        keepalive,
      )
        .then((draft) => {
          saved = true;
          saving.backoff = 0;
          if (!saving.overdue) saveDraftUUID(storageKey, draft.uuid);
          else if (saving.overdue === 'starting again' || draft.uuid !== uuid) {
            void discardDraft(eventId, draft.uuid).catch(() => {});
          }
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
          saving.overdue = null;
          // Hidden as it went, the page has had its last chance to send what changed since.
          if (saved && document.visibilityState === 'hidden') send(true);
        });
    },
    [eventId, storageKey, invitation, enabled],
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
        return orTimeout(state.current, 'sending');
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
        return orTimeout(state.current, 'starting again');
      },
    }),
    [send],
  );
}
