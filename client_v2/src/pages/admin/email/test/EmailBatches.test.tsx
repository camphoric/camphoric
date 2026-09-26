import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailBatches } from '../EmailBatches';
import { sampleBatch } from './emailFixtures';

const { cancel, retry } = vi.hoisted(() => ({ cancel: vi.fn(), retry: vi.fn() }));

vi.mock('store/groupEmail', () => ({
  useCancelBatch: () => ({ mutate: cancel, isPending: false }),
  useRetryBatch: () => ({ mutate: retry, isPending: false }),
}));

beforeEach(() => {
  cancel.mockClear();
  retry.mockClear();
});

function setup(batches = [sampleBatch()], selectedId?: number) {
  const onSelect = vi.fn();
  renderWithProviders(
    <EmailBatches batches={batches} selectedId={selectedId} onSelect={onSelect} />,
  );
  return { user: userEvent.setup(), onSelect };
}

describe('EmailBatches', () => {
  it('shows a send’s progress', () => {
    setup();
    const card = screen.getByLabelText('Send of Balance reminder');
    expect(within(card).getByText('Sending')).toBeInTheDocument();
    expect(within(card).getByText('2 of 4 sent · 1 failed · 1 waiting')).toBeInTheDocument();
    expect(within(card).getByText(/by will/)).toBeInTheDocument();
  });

  it('retries the failed copies', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Retry failed' }));
    expect(retry).toHaveBeenCalledWith(31, expect.anything());
  });

  it('asks before cancelling', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(/The 1 copy still waiting won’t be sent/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel the send' }));
    expect(cancel).toHaveBeenCalledWith(31, expect.anything());
  });

  it('shows a scheduled send’s time, and a finished one without Cancel', () => {
    setup([
      sampleBatch({
        id: 32,
        name: 'Packing list',
        state: 'scheduled',
        status: 'scheduled',
        send_at: '2026-10-01T16:00:00Z',
        total: 0,
        sent: 0,
        failed: 0,
        waiting: 0,
      }),
      sampleBatch({ state: 'done', failed: 0, waiting: 0, sent: 4 }),
    ]);
    const scheduled = screen.getByLabelText('Send of Packing list');
    expect(within(scheduled).getByText(/Scheduled for/)).toBeInTheDocument();
    expect(within(scheduled).getByText('4 recipients chosen')).toBeInTheDocument();
    const done = screen.getByLabelText('Send of Balance reminder');
    expect(within(done).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(within(done).queryByRole('button', { name: 'Retry failed' })).not.toBeInTheDocument();
  });

  it('chooses a send to show its emails, and again to show all', async () => {
    const { user, onSelect } = setup([sampleBatch()], 31);
    await user.click(screen.getByRole('button', { name: 'Showing its emails' }));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it('shows the latest three, keeping the chosen one in view', async () => {
    const batches = [1, 2, 3, 4, 5].map((id) => sampleBatch({ id, name: `Send ${id}` }));
    const { user } = setup(batches, 5);
    expect(screen.getAllByLabelText(/^Send of/).map((c) => c.getAttribute('aria-label'))).toEqual([
      'Send of Send 1',
      'Send of Send 2',
      'Send of Send 3',
      'Send of Send 5',
    ]);
    await user.click(screen.getByRole('button', { name: 'Show all 5' }));
    expect(screen.getAllByLabelText(/^Send of/)).toHaveLength(5);
  });

  it('shows nothing without sends', () => {
    setup([]);
    expect(screen.queryByText('Group email sends')).not.toBeInTheDocument();
  });
});
