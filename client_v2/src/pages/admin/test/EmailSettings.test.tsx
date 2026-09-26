import userEvent from '@testing-library/user-event';
import type { ApiEvent } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailSettings } from '../EmailSettings';
import { sampleAccount } from './emailAccountFixtures';

const { updateEvent, testAccount } = vi.hoisted(() => ({
  updateEvent: vi.fn(),
  testAccount: vi.fn(),
}));

const ACCOUNTS = [
  sampleAccount(),
  sampleAccount({
    id: 4,
    name: 'Old account',
    password_status: 'unreadable',
    max_per_minute: null,
    max_per_day: null,
  }),
];

vi.mock('store/entities', () => {
  const mutation = { mutate: vi.fn(), isPending: false };
  return {
    emailAccountHooks: {
      useList: () => ({ data: ACCOUNTS }),
      useCreate: () => mutation,
      useUpdate: () => mutation,
      useDelete: () => mutation,
    },
    eventHooks: { useUpdate: () => ({ mutate: updateEvent, isPending: false }) },
  };
});
vi.mock('store/email', () => ({
  useTestEmailAccount: () => ({ mutate: testAccount, isPending: false }),
}));

const EVENT = { id: 7, organization: 1, email_account: 3 } as ApiEvent;

describe('EmailSettings', () => {
  beforeEach(() => {
    updateEvent.mockReset();
    testAccount.mockReset();
  });

  it("lists the organization's accounts", () => {
    renderWithProviders(<EmailSettings event={EVENT} />);
    const table = within(screen.getByRole('table'));
    expect(table.getAllByText('smtp.gmail.com:587, STARTTLS')).toHaveLength(2);
    expect(table.getByText('20 a minute, 500 a day')).toBeInTheDocument();
    expect(table.getByText('No limits')).toBeInTheDocument();
    expect(table.getByText('This event')).toBeInTheDocument();
    expect(table.getByText('Re-enter password')).toBeInTheDocument();
  });

  it("changes the event's sending account", async () => {
    renderWithProviders(<EmailSettings event={EVENT} />);
    await userEvent.click(screen.getByRole('textbox', { name: /sent through/ }));
    await userEvent.click(
      await screen.findByRole('option', {
        name: 'No account: the server’s default mailer',
        hidden: true,
      }),
    );
    expect(updateEvent).toHaveBeenCalledWith({ id: 7, email_account: null }, expect.anything());
  });

  it('sends a test through an account', async () => {
    renderWithProviders(<EmailSettings event={EVENT} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Send test' })[1]);
    expect(testAccount).toHaveBeenCalledWith({ accountId: 4 }, expect.anything());
  });
});
