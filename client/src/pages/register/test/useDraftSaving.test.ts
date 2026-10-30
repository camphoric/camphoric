import { renderHook } from '@testing-library/react';
import { useRegistrationStore } from 'store/registration';
import { saveDraft } from 'store/registrationApi';
import { act } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveDraftUUID } from '../storage';
import { FIRST_BACKOFF_MS, SAVE_INTERVAL_MS, useDraftSaving } from '../useDraftSaving';

vi.mock('store/registrationApi', () => ({ saveDraft: vi.fn() }));

const KEY = 'Event 1: Camp, ';
const INVITATION = {
  recipient_name: 'Sam',
  recipient_email: 'sam@example.com',
  invitation_code: 'ABC123',
};
const save = vi.mocked(saveDraft);

/** The hook, once someone has touched the form: a change before that isn't theirs. */
function hook(invitation?: typeof INVITATION) {
  const { result } = renderHook(() => useDraftSaving('1', KEY, invitation));
  result.current.fieldFocused();
  return result;
}

function hidePage() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
}

const settle = () => act(() => vi.advanceTimersByTimeAsync(0));

describe('useDraftSaving', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    save.mockReset();
    save.mockResolvedValue({ uuid: 'draft-1' });
    useRegistrationStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saves nothing until something has changed', () => {
    const drafts = hook();
    drafts.current.fieldBlurred();
    hidePage();
    expect(save).not.toHaveBeenCalled();
  });

  it('takes no change before anyone touches the form for theirs', async () => {
    // The form reports its schema's defaults as a change as it loads.
    const { result } = renderHook(() => useDraftSaving('1', KEY, undefined));
    result.current.changed();
    hidePage();
    await settle();
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a change as the field loses focus, not as it changes', async () => {
    useRegistrationStore.getState().setRegistration({ registrant_email: 'pat@', campers: [] });
    const drafts = hook();
    drafts.current.changed();
    drafts.current.changed();
    expect(save).not.toHaveBeenCalled();

    drafts.current.fieldBlurred();
    await settle();
    expect(save).toHaveBeenCalledExactlyOnceWith(
      '1',
      { formData: { registrant_email: 'pat@', campers: [] } },
      false,
    );
    expect(localStorage.getItem(`${KEY} (draft)`)).toBe('draft-1');
  });

  it('goes on with the draft it has, and sends the invitation', async () => {
    saveDraftUUID(KEY, 'draft-0');
    const drafts = hook(INVITATION);
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();
    expect(save.mock.calls[0]?.[1]).toMatchObject({ uuid: 'draft-0', invitation: INVITATION });
  });

  it('keeps the uuid the server answers with, when it started another', async () => {
    saveDraftUUID(KEY, 'draft-gone');
    save.mockResolvedValue({ uuid: 'draft-new' });
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();
    expect(localStorage.getItem(`${KEY} (draft)`)).toBe('draft-new');
  });

  it('saves at most every 30 seconds', async () => {
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();

    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(SAVE_INTERVAL_MS));
    expect(save).toHaveBeenCalledTimes(1);
    drafts.current.fieldBlurred();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('sends a held-back change as the page is hidden, to outlive it', async () => {
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();
    drafts.current.changed();
    drafts.current.fieldBlurred();

    hidePage();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[2]).toBe(true);
  });

  it('keeps a change whose save failed, and tells no one', async () => {
    save.mockRejectedValueOnce(new Error('offline'));
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();

    await act(() => vi.advanceTimersByTimeAsync(SAVE_INTERVAL_MS));
    drafts.current.fieldBlurred();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it.each([429, 503])('backs off on a %i, even as the page is hidden', async (status) => {
    save.mockRejectedValueOnce(new ApiError(status, 'Busy', null));
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();

    await act(() => vi.advanceTimersByTimeAsync(SAVE_INTERVAL_MS));
    drafts.current.fieldBlurred();
    hidePage();
    expect(save).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MS));
    drafts.current.fieldBlurred();
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('waits as long as a Retry-After asks', async () => {
    save.mockRejectedValueOnce(new ApiError(429, 'Busy', null, 300));
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();
    await settle();

    await act(() => vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MS * 2));
    drafts.current.fieldBlurred();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('lets a save under way finish before the form is submitted', async () => {
    let answer = (_draft: { uuid: string }) => {};
    save.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const drafts = hook();
    drafts.current.changed();
    drafts.current.fieldBlurred();

    const submitted = vi.fn();
    void drafts.current.pause().then(submitted);
    await settle();
    expect(submitted).not.toHaveBeenCalled();

    answer({ uuid: 'draft-1' });
    await settle();
    expect(submitted).toHaveBeenCalled();
    expect(localStorage.getItem(`${KEY} (draft)`)).toBe('draft-1');
  });

  it('forgets what it held on starting again, and needs touching again', async () => {
    const drafts = hook();
    drafts.current.changed();
    await act(() => drafts.current.stop());

    drafts.current.changed();
    drafts.current.fieldBlurred();
    hidePage();
    await settle();
    expect(save).not.toHaveBeenCalled();
  });

  it('holds off while the form is submitted, and goes on if that fails', async () => {
    const drafts = hook();
    drafts.current.changed();
    void drafts.current.pause();
    drafts.current.fieldBlurred();
    hidePage();
    expect(save).not.toHaveBeenCalled();

    drafts.current.resume();
    drafts.current.fieldBlurred();
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
