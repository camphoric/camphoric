import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnsubscribePage } from '../UnsubscribePage';
import { LINK } from './fixtures';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({ useParams: () => ({ token: 'tok:en' }) }));
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch,
}));

const LINK_URL = '/api/email/unsubscribe/tok%3Aen';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderWithProviders(
    <QueryClientProvider client={client}>
      <UnsubscribePage />
    </QueryClientProvider>,
  );
  return client;
}

function answer(get: () => unknown, post?: () => unknown) {
  apiFetch.mockImplementation((_url: string, options?: { method?: string }) =>
    options?.method === 'POST' ? Promise.resolve().then(post) : Promise.resolve().then(get),
  );
}

// A block, not `() => apiFetch.mockReset()`: a function beforeEach returns is run after the test.
beforeEach(() => {
  apiFetch.mockReset();
});

describe('UnsubscribePage', () => {
  it('asks to confirm, and opening it changes nothing', async () => {
    answer(() => LINK);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Unsubscribe?' })).toBeInTheDocument();
    expect(screen.getByText('Lark Camp 2027')).toBeInTheDocument();
    expect(screen.getByText('pat@example.com')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    // It names the recipient's address, so search engines are asked not to index it.
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
    expect(apiFetch).toHaveBeenCalledWith(
      LINK_URL,
      expect.not.objectContaining({ method: 'POST' }),
    );
  });

  it('confirming unsubscribes and says so', async () => {
    answer(
      () => LINK,
      () => ({ ...LINK, unsubscribed: true }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));
    expect(await screen.findByRole('heading', { name: 'You’re unsubscribed' })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(LINK_URL, { method: 'POST' });
  });

  it('says when the address is already unsubscribed', async () => {
    answer(() => ({ ...LINK, unsubscribed: true }));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'You’re unsubscribed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).toBeNull();
  });

  it('keeps showing the answer when a later read fails', async () => {
    let calls = 0;
    answer(() => {
      calls += 1;
      if (calls > 1) throw new ApiError(502, 'Bad Gateway', null);
      return { ...LINK, unsubscribed: true };
    });
    const client = renderPage();
    expect(await screen.findByRole('heading', { name: 'You’re unsubscribed' })).toBeInTheDocument();
    await act(() => client.refetchQueries());
    expect(calls).toBe(2);
    expect(screen.getByRole('heading', { name: 'You’re unsubscribed' })).toBeInTheDocument();
  });

  it('says when the link has been changed', async () => {
    answer(() => {
      throw new ApiError(400, 'Bad Request', {
        code: 'invalid',
        detail: 'The unsubscribe link is incomplete or has been changed.',
      });
    });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'This link doesn’t work' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/incomplete or has been changed/)).toBeInTheDocument();
  });

  it('says when the event no longer exists', async () => {
    answer(() => {
      throw new ApiError(404, 'Not Found', {
        code: 'gone',
        detail: 'The event this email was about no longer exists.',
      });
    });
    renderPage();
    expect(await screen.findByText(/no longer exists/)).toBeInTheDocument();
  });

  it('offers to try again when the link couldn’t be checked', async () => {
    let calls = 0;
    answer(() => {
      calls += 1;
      if (calls === 1) throw new ApiError(502, 'Bad Gateway', null);
      return LINK;
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Unsubscribe?' })).toBeInTheDocument();
  });

  it('shows a failed confirmation, to try again', async () => {
    answer(
      () => LINK,
      () => {
        throw new ApiError(500, 'Server Error', { detail: 'Something broke.' });
      },
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));
    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeInTheDocument();
  });
});
