import userEvent from '@testing-library/user-event';
import type { ApiEmailUnsubscribe } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailUnsubscribes } from '../EmailUnsubscribes';

const { remove, add, state } = vi.hoisted(() => ({
  remove: vi.fn(),
  add: vi.fn(),
  state: { rows: [] as ApiEmailUnsubscribe[], addError: null as ApiError | null },
}));

vi.mock('store/entities', () => ({
  emailUnsubscribeHooks: {
    useList: () => ({ data: state.rows }),
    useDelete: () => ({ mutate: remove }),
  },
}));
vi.mock('store/groupEmail', () => ({
  useAddUnsubscribe: () => ({ mutate: add, isPending: false, error: state.addError }),
}));

const row = (fields: Partial<ApiEmailUnsubscribe>): ApiEmailUnsubscribe => ({
  id: 1,
  event: 7,
  email: 'pat@example.com',
  source: 'link',
  created_by: null,
  created_by_name: null,
  created_at: '2026-09-20T15:00:00Z',
  ...fields,
});

beforeEach(() => {
  remove.mockClear();
  add.mockClear();
  state.rows = [
    row({}),
    row({ id: 2, email: 'kim@example.com', source: 'admin', created_by_name: 'will' }),
  ];
  state.addError = null;
});

describe('EmailUnsubscribes', () => {
  it('lists who unsubscribed and how', () => {
    renderWithProviders(<EmailUnsubscribes eventId={7} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual([
      'Unsubscribe link',
      'Added by will',
    ]);
  });

  it('adds an address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailUnsubscribes eventId={7} />);
    const button = screen.getByRole('button', { name: 'Unsubscribe address' });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Address to unsubscribe' }), ' lou@x.org');
    await user.click(button);
    expect(add).toHaveBeenCalledWith({ eventId: 7, email: 'lou@x.org' }, expect.anything());
  });

  it('shows why an address can’t be added', () => {
    state.addError = new ApiError(400, 'Bad Request', {
      email: ['This address is already unsubscribed.'],
    });
    renderWithProviders(<EmailUnsubscribes eventId={7} />);
    expect(screen.getByText('This address is already unsubscribed.')).toBeInTheDocument();
  });

  it('asks before removing an address', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmailUnsubscribes eventId={7} />);
    await user.click(screen.getByRole('button', { name: 'Remove kim@example.com' }));
    expect(await screen.findByText(/will get this event’s group emails again/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(remove).toHaveBeenCalledWith({ id: 2 }, expect.anything());
  });

  it('says when no one has unsubscribed', () => {
    state.rows = [];
    renderWithProviders(<EmailUnsubscribes eventId={7} />);
    expect(screen.getByText('No one has unsubscribed.')).toBeInTheDocument();
  });
});
