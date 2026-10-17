import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { anonymousUser, type ApiUser } from 'api-types';
import type { ReactNode } from 'react';
import { apiFetch } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCurrentUser, useLogin, useLogout, WHOAMI_KEY } from '../auth';

// What each endpoint answers next.
const api = vi.hoisted((): Record<'whoami' | 'login' | 'users', unknown> => ({
  whoami: undefined,
  login: undefined,
  users: undefined,
}));

vi.mock('utils/fetch', () => ({
  apiFetch: vi.fn((url: string) => {
    if (url === '/api/user') return Promise.resolve(api.whoami);
    if (url === '/api/login') return Promise.resolve(api.login);
    if (url === '/api/users') return Promise.resolve(api.users);
    return Promise.resolve(undefined);
  }),
}));

const user = (id: number, username: string): ApiUser => ({
  ...anonymousUser,
  id,
  username,
  is_active: true,
  role: 'admin',
});
const admin = user(1, 'admin');
const reporter = user(2, 'reporter');
const USERS_KEY = ['Users'];

function setup(signedIn: ApiUser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(WHOAMI_KEY, signedIn);
  client.setQueryData(USERS_KEY, [signedIn]);
  api.whoami = signedIn;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => ({ user: useCurrentUser(), login: useLogin(), logout: useLogout() }),
    { wrapper },
  );
  return { client, ...hook };
}

/** The session ends without a sign-out (it expired); whoami turns anonymous. */
async function expire(client: QueryClient) {
  api.whoami = anonymousUser;
  await act(() => client.invalidateQueries({ queryKey: WHOAMI_KEY }));
}

async function signIn(result: { current: { login: ReturnType<typeof useLogin> } }, as: ApiUser) {
  api.login = as;
  api.whoami = as;
  await act(() => result.current.login.mutateAsync({ username: as.username, password: 'pw' }));
}

beforeEach(() => {
  api.whoami = undefined;
  api.login = undefined;
  api.users = undefined;
});

describe('auth hooks: the query cache follows the signed-in user (SPEC §6)', () => {
  it('signing out drops every cached query but whoami', async () => {
    const { client, result } = setup(admin);

    api.whoami = anonymousUser;
    await act(() => result.current.logout.mutateAsync());

    expect(client.getQueryData(USERS_KEY)).toBeUndefined();
    expect(client.getQueryData(WHOAMI_KEY)).toEqual(anonymousUser);
  });

  it('signing in as someone else after the session expired drops the last user’s data', async () => {
    const { client, result } = setup(admin);
    await expire(client);
    expect(client.getQueryData(USERS_KEY)).toEqual([admin]);

    await signIn(result, reporter);

    expect(client.getQueryData(USERS_KEY)).toBeUndefined();
    await waitFor(() => expect(result.current.user.data).toEqual(reporter));
  });

  it('signing back in as the same user keeps their cached data', async () => {
    const { client, result } = setup(admin);
    await expire(client);

    await signIn(result, admin);

    expect(client.getQueryData(USERS_KEY)).toEqual([admin]);
    await waitFor(() => expect(result.current.user.data).toEqual(admin));
  });

  it('a whoami refetch that finds someone else signed in (in another tab) drops the last user’s data', async () => {
    const { client, result } = setup(admin);
    await expire(client);

    api.whoami = reporter;
    await act(() => client.invalidateQueries({ queryKey: WHOAMI_KEY }));

    expect(client.getQueryData(USERS_KEY)).toBeUndefined();
    await waitFor(() => expect(result.current.user.data).toEqual(reporter));
  });

  it('a whoami refetch that finds the same user signed back in keeps their cached data', async () => {
    const { client } = setup(admin);
    await expire(client);

    api.whoami = admin;
    await act(() => client.invalidateQueries({ queryKey: WHOAMI_KEY }));

    expect(client.getQueryData(USERS_KEY)).toEqual([admin]);
  });

  it('a view still on screen refetches its data as the new user', async () => {
    const { client, result } = setup(admin);
    api.users = [admin];
    const view = renderHook(
      () => useQuery({ queryKey: USERS_KEY, queryFn: () => apiFetch<ApiUser[]>('/api/users') }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await expire(client);

    api.users = [reporter];
    await signIn(result, reporter);

    await waitFor(() => expect(view.result.current.data).toEqual([reporter]));
  });

  it('shows the new user as soon as the sign-in succeeds, before whoami refetches', async () => {
    const { client, result } = setup(admin);
    await expire(client);
    api.login = reporter;
    let refetched: () => void = () => {};
    api.whoami = new Promise((resolve) => {
      refetched = () => resolve(reporter);
    });

    act(() => result.current.login.mutate({ username: 'reporter', password: 'pw' }));

    await waitFor(() => expect(result.current.user.data).toEqual(reporter));
    expect(client.getQueryData(USERS_KEY)).toBeUndefined();
    refetched();
    await waitFor(() => expect(result.current.login.isSuccess).toBe(true));
  });
});
