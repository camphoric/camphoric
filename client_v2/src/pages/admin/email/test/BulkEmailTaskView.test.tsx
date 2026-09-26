import userEvent from '@testing-library/user-event';
import type { ApiBulkEmailTask, BulkRecipientResolution } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BulkEmailTaskView } from '../BulkEmailTaskView';

const { dryRun, send, cancel, test } = vi.hoisted(() => ({
  dryRun: vi.fn(),
  send: vi.fn(),
  cancel: vi.fn(),
  test: vi.fn(),
}));

vi.mock('store/bulkEmail', () => ({
  useBulkEmailRecipients: () => ({
    data: [
      {
        id: 1,
        email: 'pat@example.com',
        full_name: 'Pat',
        sent_time: '2026-10-01T12:00:00Z',
        error: null,
      },
      {
        id: 2,
        email: 'lee@example.com',
        full_name: 'Lee',
        sent_time: null,
        error: 'Template problem (x)',
      },
    ],
  }),
  useResolveDryRun: () => ({ mutate: dryRun, isPending: false }),
  useSendBulkEmail: () => ({ mutate: send, isPending: false }),
  useCancelBulkEmail: () => ({ mutate: cancel, isPending: false }),
  useTestBulkEmail: () => ({ mutate: test, isPending: false }),
}));
vi.mock('hooks/auth', () => ({ useCurrentUser: () => ({ data: { email: 'me@camp.org' } }) }));

const task = (overrides: Partial<ApiBulkEmailTask> = {}) =>
  ({
    id: 7,
    subject: 'Balances',
    from_email: 'reg@camp.org',
    status: 'draft',
    recipient_count: 2,
    sent_count: 1,
    error_count: 1,
    ...overrides,
  }) as ApiBulkEmailTask;

const resolution: BulkRecipientResolution = {
  recipients: [
    { email: 'pat@example.com', name: '', label: 'Pat', registration: 1, camper: null },
    { email: 'lee@example.com', name: '', label: 'Lee', registration: 2, camper: null },
    { email: 'sam@example.com', name: '', label: 'Sam', registration: 3, camper: null },
  ],
  skipped: [],
  diagnostics: [],
  counts: { recipients: 3, skipped: 0, already_sent: 1, kept_existing: false },
};

beforeEach(() => {
  [dryRun, send, cancel, test].forEach((fn) => fn.mockReset());
});

describe('BulkEmailTaskView', () => {
  it('shows progress and each recipient’s status', () => {
    renderWithProviders(<BulkEmailTaskView task={task()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/1 of 2 sent/)).toBeInTheDocument();
    expect(screen.getByText('Template problem (x)')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('confirms how many it will send to before sending', async () => {
    dryRun.mockImplementation(
      (_id: number, { onSuccess }: { onSuccess: (r: BulkRecipientResolution) => void }) =>
        onSuccess(resolution),
    );
    const user = userEvent.setup();
    renderWithProviders(<BulkEmailTaskView task={task()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Send…' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('will be sent to 2 recipients');
    expect(dialog).toHaveTextContent('1 already sent to won’t get it again');
    await user.click(screen.getByRole('button', { name: 'Send to 2' }));
    expect(send).toHaveBeenCalledWith(7);
  });

  it('can be stopped while sending, and resumed after', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <BulkEmailTaskView task={task({ status: 'running' })} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Stop sending' }));
    expect(cancel).toHaveBeenCalledWith(7);
    rerender(
      <BulkEmailTaskView task={task({ status: 'stopped' })} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Resume…' })).toBeInTheDocument();
  });

  it('sends a test to the signed-in admin by default', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkEmailTaskView task={task()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Send a test…' }));
    expect(await screen.findByLabelText('Send to')).toHaveValue('me@camp.org');
    await user.click(screen.getByRole('button', { name: 'Send test' }));
    expect(test).toHaveBeenCalledWith({ taskId: 7, to: 'me@camp.org' }, expect.anything());
  });
});
