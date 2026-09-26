import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { MessageDetail } from '../MessageDetail';
import { sampleMessage } from './emailFixtures';

describe('MessageDetail', () => {
  it('shows who it went to and what was sent', async () => {
    renderWithProviders(<MessageDetail message={sampleMessage()} />);
    expect(screen.getByText('Welcome to camp, Pat!')).toBeInTheDocument();
    expect(screen.getByText('pat@example.com')).toBeInTheDocument();
    expect(screen.getByText('Camp Gmail')).toBeInTheDocument();
    expect(screen.getByTitle('Email: Welcome to camp, Pat!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Plain text' }));
    expect(screen.getByText(/See you in July/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('offers to retry a failed message, with the reason it failed', async () => {
    const onRetry = vi.fn();
    const message = sampleMessage({
      status: 'failed',
      sent_at: null,
      attempts: 6,
      last_error: 'SMTPRecipientsRefused: pat@example.com: 550 No such user',
    });
    renderWithProviders(<MessageDetail message={message} onRetry={onRetry} />);
    expect(screen.getByText(/550 No such user/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('offers to stop a queued message, and shows its next try', async () => {
    const onCancel = vi.fn();
    const message = sampleMessage({
      status: 'queued',
      sent_at: null,
      attempts: 1,
      last_error: 'SMTPServerDisconnected: Connection unexpectedly closed',
    });
    renderWithProviders(<MessageDetail message={message} onCancel={onCancel} />);
    expect(screen.getByText('Next try')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "Don't send" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('names the default mailer when there is no account', () => {
    renderWithProviders(
      <MessageDetail message={sampleMessage({ account: null, account_name: null })} />,
    );
    expect(screen.getByText('The server’s default mailer')).toBeInTheDocument();
  });
});
