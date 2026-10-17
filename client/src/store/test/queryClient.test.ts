import { notifications } from '@mantine/notifications';
import { QueryObserver } from '@tanstack/react-query';
import { anonymousUser, type ApiUser } from 'api-types';
import { ApiError } from 'utils/fetch';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { describeError, queryClient } from '../queryClient';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

const conflict = () =>
  new ApiError(412, 'Precondition Failed', {
    detail: 'Someone else changed this since you opened it.',
    code: 'version_conflict',
    current: { id: 1, version: 4 },
  });

describe('describeError', () => {
  it('uses the detail, with the first template problem', () => {
    expect(describeError(new ApiError(400, 'Bad Request', { detail: 'Nope.' }))).toBe('Nope.');
    expect(
      describeError(
        new ApiError(400, 'Bad Request', {
          detail: 'The template has problems.',
          diagnostics: [{ severity: 'error', message: "invitation has no field 'x'", line: 2 }],
        }),
      ),
    ).toBe("The template has problems. Line 2: invitation has no field 'x'");
  });

  it('lists field errors', () => {
    expect(
      describeError(
        new ApiError(400, 'Bad Request', {
          body: ['Line 2: unexpected end of template'],
        }),
      ),
    ).toBe('body: Line 2: unexpected end of template');
  });

  it('says a refusal is about permission', () => {
    const refused = new ApiError(403, 'Forbidden', {
      detail: 'You do not have permission to perform this action.',
    });
    expect(describeError(refused)).toBe("You don't have permission to do that.");
  });

  it('says a save was refused because someone else changed the record first', () => {
    expect(describeError(conflict())).toBe(
      'Someone else changed this since you opened it, so your change wasn’t saved.',
    );
  });

  it('falls back to the status', () => {
    expect(describeError(new ApiError(500, 'Server Error', null))).toBe('500 Server Error');
  });
});

describe('the shared failure toast (DR-10, DR-109)', () => {
  const fail = (meta?: Record<string, unknown>) =>
    queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => Promise.reject(conflict()), meta, retry: false })
      .execute(undefined)
      .catch(() => undefined);

  it('reports a conflict nobody handles', async () => {
    vi.mocked(notifications.show).mockClear();
    await fail();
    expect(notifications.show).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the screen shows the conflict itself', async () => {
    vi.mocked(notifications.show).mockClear();
    await fail({ handlesVersionConflict: true });
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('stays quiet about a registration the page goes back to send again (#769)', async () => {
    const notFound = new ApiError(404, 'Not Found', {
      detail: 'We couldn’t find your earlier registration. Please send the form again.',
      code: 'registration_not_found',
    });
    const failWith = (error: ApiError) =>
      queryClient
        .getMutationCache()
        .build(queryClient, {
          mutationFn: () => Promise.reject(error),
          meta: { handlesRegistrationNotFound: true },
          retry: false,
        })
        .execute(undefined)
        .catch(() => undefined);

    vi.mocked(notifications.show).mockClear();
    await failWith(notFound);
    expect(notifications.show).not.toHaveBeenCalled();
    await failWith(new ApiError(500, 'Server Error', null));
    expect(notifications.show).toHaveBeenCalledTimes(1);
  });
});

describe('a lapsed session (DR-9)', () => {
  const WHOAMI = ['WhoAmI'];
  const pat: ApiUser = { ...anonymousUser, id: 3, username: 'pat', is_active: true, role: 'admin' };
  const unauthorized = () =>
    new ApiError(401, 'Unauthorized', {
      detail: 'Authentication credentials were not provided.',
    });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  let unsubscribe = () => {};

  /** Pat is signed in, and the admin's guard is watching who's signed in. */
  function signedInAdmin(whoami: () => Promise<ApiUser>) {
    queryClient.setQueryData(WHOAMI, pat);
    const observer = new QueryObserver(queryClient, {
      queryKey: WHOAMI,
      queryFn: whoami,
      staleTime: 10_000,
      retry: false,
    });
    unsubscribe = observer.subscribe(() => undefined);
  }

  const failSave = (error: Error, meta?: Record<string, unknown>) =>
    queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => Promise.reject(error), meta, retry: false })
      .execute(undefined)
      .catch(() => undefined);

  afterEach(() => {
    unsubscribe();
    queryClient.clear();
    vi.mocked(notifications.show).mockClear();
  });

  it('asks who is signed in instead of reporting a failed save, and stays on the page', async () => {
    const whoami = vi.fn(() => Promise.resolve(anonymousUser));
    signedInAdmin(whoami);
    const url = window.location.href;

    await failSave(unauthorized());
    await vi.waitFor(() => expect(queryClient.getQueryData(WHOAMI)).toEqual(anonymousUser));
    await settle();

    expect(whoami).toHaveBeenCalledTimes(1);
    expect(notifications.show).not.toHaveBeenCalled();
    expect(window.location.href).toBe(url);
  });

  it('asks once when several requests fail together', async () => {
    const whoami = vi.fn(
      () => new Promise<ApiUser>((resolve) => setTimeout(() => resolve(anonymousUser), 10)),
    );
    signedInAdmin(whoami);

    await Promise.all([failSave(unauthorized()), failSave(unauthorized())]);
    await vi.waitFor(() => expect(queryClient.getQueryData(WHOAMI)).toEqual(anonymousUser));

    expect(whoami).toHaveBeenCalledTimes(1);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('stays quiet when an earlier check already found them signed out', async () => {
    const whoami = vi.fn(() => Promise.resolve(anonymousUser));
    signedInAdmin(whoami);
    let refuse: (error: Error) => void = () => {};
    const save = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => new Promise((_resolve, reject) => (refuse = reject)),
        retry: false,
      })
      .execute(undefined)
      .catch(() => undefined);

    // The session monitor's check lands while the save is still in flight.
    await queryClient.invalidateQueries({ queryKey: WHOAMI });
    expect(queryClient.getQueryData(WHOAMI)).toEqual(anonymousUser);
    refuse(unauthorized());
    await save;
    await settle();

    expect(notifications.show).not.toHaveBeenCalled();
    expect(whoami).toHaveBeenCalledTimes(1);
  });

  it('asks who is signed in when a query is refused', async () => {
    const whoami = vi.fn(() => Promise.resolve(anonymousUser));
    signedInAdmin(whoami);

    await queryClient
      .fetchQuery({
        queryKey: ['Registrations'],
        queryFn: () => Promise.reject(unauthorized()),
        retry: false,
      })
      .catch(() => undefined);

    await vi.waitFor(() => expect(queryClient.getQueryData(WHOAMI)).toEqual(anonymousUser));
  });

  it('reports the failure after all when the server says they are still signed in', async () => {
    const whoami = vi.fn(() => Promise.resolve(pat));
    signedInAdmin(whoami);

    await failSave(unauthorized());

    await vi.waitFor(() => expect(notifications.show).toHaveBeenCalledTimes(1));
    expect(whoami).toHaveBeenCalledTimes(1);
  });

  it('keeps a hidden failure hidden when they are still signed in', async () => {
    const whoami = vi.fn(() => Promise.resolve(pat));
    signedInAdmin(whoami);

    await failSave(unauthorized(), { suppressErrorNotification: true });
    await vi.waitFor(() => expect(whoami).toHaveBeenCalledTimes(1));
    await settle();

    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('does not re-check the whoami check itself', async () => {
    const whoami = vi.fn(() => Promise.reject(unauthorized()));
    signedInAdmin(whoami);

    await queryClient.refetchQueries({ queryKey: WHOAMI });
    await settle();

    expect(whoami).toHaveBeenCalledTimes(1);
  });

  it('just reports a 401 where nobody is watching who is signed in (registration)', async () => {
    queryClient.setQueryData(WHOAMI, pat);

    await failSave(unauthorized());
    await settle();

    expect(notifications.show).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(WHOAMI)).toEqual(pat);
  });
});
