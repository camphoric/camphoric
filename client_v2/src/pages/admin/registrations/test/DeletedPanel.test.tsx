import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeletedPanel } from '../DeletedPanel';

const { restore } = vi.hoisted(() => ({ restore: vi.fn() }));
const reggie = { id: 4, username: 'reggie', name: 'Reggie Registrar' };

vi.mock('@tanstack/react-router', () => ({ useParams: () => ({ eventId: '7' }) }));
vi.mock('store/entities', () => ({
  registrationHooks: {
    useList: () => ({ data: [{ id: 2, registrant_email: 'lee@example.com' }] }),
  },
}));
vi.mock('store/deletes', () => ({
  useDeletedRegistrations: () => ({
    data: [
      {
        id: 1,
        registrant_email: 'pat@example.com',
        camper_count: 2,
        deleted_at: '2026-09-26T18:00:00Z',
        deleted_by: reggie,
      },
    ],
  }),
  useDeletedCampers: () => ({
    data: [
      {
        id: 9,
        registration: 2,
        attributes: { first_name: 'Sam', last_name: 'Beta' },
        deleted_at: '2026-09-26T18:10:00Z',
        deleted_by: null,
      },
    ],
  }),
  useDeletedPayments: () => ({ data: [] }),
  useRestore: () => ({ mutate: restore, isPending: false }),
}));

beforeEach(() => restore.mockClear());

describe('DeletedPanel', () => {
  it('lists what’s deleted, with who deleted it', () => {
    renderWithProviders(<DeletedPanel />);
    const registration = screen.getByText('pat@example.com').closest('tr') as HTMLElement;
    expect(within(registration).getByText('2')).toBeInTheDocument();
    expect(within(registration).getByText('Reggie Registrar')).toBeInTheDocument();

    const camper = screen.getByText('Sam Beta').closest('tr') as HTMLElement;
    expect(within(camper).getByText('lee@example.com')).toBeInTheDocument();
    expect(within(camper).getByText('—')).toBeInTheDocument();

    expect(screen.getByText('No payments deleted on their own.')).toBeInTheDocument();
  });

  it('restores one', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeletedPanel />);
    await user.click(screen.getByRole('button', { name: 'Restore pat@example.com' }));
    expect(restore).toHaveBeenCalledWith(1, expect.anything());
  });
});
