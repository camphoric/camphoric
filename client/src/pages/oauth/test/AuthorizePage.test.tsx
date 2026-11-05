import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { anonymousUser, type ApiUser } from 'api-types';
import { PUBLISHED_CONTRACT } from 'components/Contract/test/contractFixtures';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizePage } from '../AuthorizePage';
import { OAUTH_REQUEST, SIGNED_IN } from './oauthFixtures';

const state = vi.hoisted(() => ({
  user: undefined as ApiUser | undefined,
  request: {},
  decided: { redirect_to: 'https://app.example.com/cb?code=abc&state=xyz' },
  decideError: null as ApiError | null,
  refetch: vi.fn(),
  calls: {
    decide: vi.fn(),
    logout: vi.fn(),
    leave: vi.fn(),
    agree: vi.fn(),
  },
}));

vi.mock('navigation/initialSearch', () => ({
  initialSearch: 'response_type=code&client_id=app&state=%22quoted%22',
}));
vi.mock('utils/leavePage', () => ({ leavePage: state.calls.leave }));
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ subscribe: () => () => undefined }),
}));
vi.mock('hooks/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('hooks/auth')>()),
  useCurrentUser: () => ({ data: state.user, isLoading: false }),
  useLogout: () => ({
    mutate: (_: unknown, options?: { onSettled?: () => void }) => {
      state.calls.logout();
      options?.onSettled?.();
    },
    isPending: false,
  }),
  useLogin: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('store/apps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('store/apps')>()),
  useOAuthRequest: (_query: string, enabled: boolean) =>
    enabled ? { refetch: state.refetch, ...state.request } : { isPending: true, isError: false },
  useDecideOAuthRequest: (query: string) => ({
    mutate: (
      allow: boolean,
      options?: {
        onSuccess?: (d: { redirect_to: string }) => void;
        onError?: (error: unknown) => void;
      },
    ) => {
      state.calls.decide(query, allow);
      if (state.decideError) {
        options?.onError?.(state.decideError);
        return;
      }
      options?.onSuccess?.(
        allow ? state.decided : { redirect_to: 'https://app.example.com/cb?error=access_denied' },
      );
    },
    isPending: false,
    isError: false,
  }),
}));
vi.mock('store/contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('store/contracts')>()),
  useOrganizationContract: () => ({
    isPending: false,
    isError: false,
    data: { contract: PUBLISHED_CONTRACT, agreed: false },
  }),
  useAgreeToContract: () => ({ mutate: state.calls.agree, isPending: false, isError: false }),
}));

function renderPage() {
  return renderWithProviders(
    <QueryClientProvider client={new QueryClient()}>
      <AuthorizePage />
    </QueryClientProvider>,
    { withPortals: true },
  );
}

const loaded = { isPending: false, isError: false, data: OAUTH_REQUEST, error: null };

describe('AuthorizePage', () => {
  beforeEach(() => {
    state.user = SIGNED_IN;
    state.request = loaded;
    state.decideError = null;
    state.refetch.mockReset();
    Object.values(state.calls).forEach((call) => call.mockReset());
  });

  it('asks someone signed out to sign in first', () => {
    state.user = anonymousUser;
    renderPage();
    expect(screen.getByRole('heading', { name: 'Sign in to Camphoric' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('shows what the app asks for, then connects it and returns to it', async () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Connect Camp admin tool to your Camphoric account?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/See what your Camphoric permission group/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    // The request goes on exactly as the app sent it.
    expect(state.calls.decide).toHaveBeenCalledWith(
      'response_type=code&client_id=app&state=%22quoted%22',
      true,
    );
    expect(state.calls.leave).toHaveBeenCalledWith(state.decided.redirect_to);
  });

  it('cancelling returns to the app', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.calls.leave).toHaveBeenCalledWith(
      'https://app.example.com/cb?error=access_denied',
    );
  });

  it('signs out to sign in as someone else, keeping the request', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Not you\?/ }));
    expect(state.calls.logout).toHaveBeenCalled();
    expect(state.calls.leave).not.toHaveBeenCalled();
  });

  it('asks for the terms first, and declining tells the app and signs out', async () => {
    state.user = { ...SIGNED_IN, pending_contract_organizations: [1, 2] };
    renderPage();
    expect(screen.getByText('Organization 1 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /I don’t agree/ }));
    expect(state.calls.decide).toHaveBeenCalledWith(expect.any(String), false);
    expect(state.calls.logout).toHaveBeenCalled();
    expect(state.calls.leave).toHaveBeenCalledWith(
      'https://app.example.com/cb?error=access_denied',
    );
  });

  it('sends a refused request back to the app with its error', () => {
    const redirect = 'https://app.example.com/cb?error=invalid_request&state=xyz';
    state.request = {
      isPending: false,
      isError: true,
      error: new ApiError(400, 'Bad Request', {
        error: 'invalid_request',
        description: 'Code challenge required.',
        redirect_to: redirect,
      }),
    };
    renderPage();
    expect(state.calls.leave).toHaveBeenCalledWith(redirect);
  });

  it('explains a request that can’t say where to go', () => {
    state.request = {
      isPending: false,
      isError: true,
      error: new ApiError(400, 'Bad Request', {
        error: 'invalid_request',
        description: 'Mismatching redirect URI.',
        redirect_to: null,
      }),
    };
    renderPage();
    expect(screen.getByRole('heading', { name: 'This app can’t connect' })).toBeInTheDocument();
    expect(screen.getByText('Mismatching redirect URI.')).toBeInTheDocument();
    expect(state.calls.leave).not.toHaveBeenCalled();
  });

  it('says why someone can’t connect apps', () => {
    state.request = {
      isPending: false,
      isError: true,
      error: new ApiError(403, 'Forbidden', {
        detail: 'Choose a new password in Camphoric before connecting an app.',
        code: 'cannot_connect_apps',
      }),
    };
    renderPage();
    expect(screen.getByRole('heading', { name: 'You can’t connect apps' })).toBeInTheDocument();
    expect(screen.getByText(/Choose a new password/)).toBeInTheDocument();
  });

  it('signs out even when the app can’t be told the terms were declined', async () => {
    state.user = { ...SIGNED_IN, pending_contract_organizations: [1] };
    state.decideError = new ApiError(502, 'Bad Gateway', null);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /I don’t agree/ }));
    expect(state.calls.logout).toHaveBeenCalled();
    expect(state.calls.leave).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'You’re signed out' })).toBeInTheDocument();
  });

  it('stops when connecting is refused with nowhere to tell the app', async () => {
    state.decideError = new ApiError(400, 'Bad Request', {
      error: 'invalid_client',
      description: 'The app is no longer registered.',
      redirect_to: null,
    });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('heading', { name: 'This app can’t connect' })).toBeInTheDocument();
    expect(state.calls.leave).not.toHaveBeenCalled();
  });

  it('offers to try again when the request couldn’t be checked', async () => {
    state.request = {
      isPending: false,
      isError: true,
      isFetching: false,
      error: new ApiError(502, 'Bad Gateway', null),
    };
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'The app’s request couldn’t be checked' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('You can’t connect apps')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it('keeps the request as sent in the address, so reloading sends it again', () => {
    window.history.replaceState(null, '', '/o/authorize?response_type=code&state=quoted');
    renderPage();
    expect(window.location.search).toBe('?response_type=code&client_id=app&state=%22quoted%22');
  });
});
