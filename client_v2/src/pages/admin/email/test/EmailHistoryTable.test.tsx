import userEvent from '@testing-library/user-event';
import type { ApiEmailMessage, Paginated } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EmailHistoryTable } from '../EmailHistoryTable';
import { sampleMessage } from './emailFixtures';

function page(results: ApiEmailMessage[], count = results.length): Paginated<ApiEmailMessage> {
  return { count, next: null, previous: null, results };
}

const MESSAGES = [
  sampleMessage({ id: 1 }),
  sampleMessage({
    id: 2,
    kind: 'invitation',
    to: 'lee@example.com',
    subject: 'Join us',
    status: 'queued',
    sent_at: null,
    attempts: 2,
  }),
  sampleMessage({ id: 3, status: 'failed', sent_at: null, subject: 'Bounced' }),
];

describe('EmailHistoryTable', () => {
  it('lists the messages with their kind and status', () => {
    renderWithProviders(
      <EmailHistoryTable
        page={page(MESSAGES)}
        filters={{}}
        onFiltersChange={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Join us')).toBeInTheDocument();
    expect(table.getByText('Invitation')).toBeInTheDocument();
    expect(table.getByText('Retrying (2 tried)')).toBeInTheDocument();
    expect(table.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('3 emails')).toBeInTheDocument();
  });

  it('opens a message', async () => {
    const onOpen = vi.fn();
    renderWithProviders(
      <EmailHistoryTable
        page={page(MESSAGES)}
        filters={{}}
        onFiltersChange={vi.fn()}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByText('Bounced'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('filters by status from the first page', async () => {
    const onFiltersChange = vi.fn();
    renderWithProviders(
      <EmailHistoryTable
        page={page(MESSAGES, 120)}
        filters={{ page: 2 }}
        onFiltersChange={onFiltersChange}
        onOpen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Failed' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ page: 1, status: 'failed' });
  });

  it('pages through the history', async () => {
    const onFiltersChange = vi.fn();
    renderWithProviders(
      <EmailHistoryTable
        page={page(MESSAGES, 120)}
        filters={{ status: 'sent' }}
        onFiltersChange={onFiltersChange}
        onOpen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ status: 'sent', page: 3 });
  });

  it('says when nothing matches', () => {
    renderWithProviders(
      <EmailHistoryTable
        page={page([])}
        filters={{ q: 'nobody' }}
        onFiltersChange={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('No email matches.')).toBeInTheDocument();
  });
});
