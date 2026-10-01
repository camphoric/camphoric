import userEvent from '@testing-library/user-event';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PromoCodesSettings } from '../PromoCodesSettings';
import { samplePromoCode } from './promoCodeFixtures';

const { create, restore } = vi.hoisted(() => ({ create: vi.fn(), restore: vi.fn() }));

const CODES = [
  samplePromoCode(),
  samplePromoCode({ id: 4, label: 'Sibling', code: 'SIB', scope: 'camper', enabled: false }),
  samplePromoCode({
    id: 5,
    label: 'Last year',
    code: 'OLD',
    expiration_date: '2020-01-01T00:00:00Z',
  }),
];
const DELETED = [
  {
    ...samplePromoCode({ id: 6, label: 'Mistake', code: 'OOPS' }),
    deleted_at: '2026-09-02T12:00:00Z',
    deleted_by: { id: 1, username: 'reggie', name: 'Reggie' },
  },
];

vi.mock('store/entities', () => {
  const mutation = { mutate: vi.fn(), isPending: false };
  return {
    promoCodeHooks: {
      useList: () => ({ data: CODES }),
      useCreate: () => ({ mutate: create, isPending: false }),
      useUpdate: () => mutation,
      useDelete: () => mutation,
    },
  };
});
vi.mock('store/deletes', () => ({
  useDeletedPromoCodes: (_eventId: string, enabled: boolean) => ({
    data: enabled ? DELETED : undefined,
  }),
  useRestore: () => ({ mutate: restore, isPending: false }),
}));
vi.mock('components/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Discount logic"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

beforeEach(() => {
  create.mockReset();
  restore.mockReset();
});

describe('PromoCodesSettings', () => {
  it('lists the codes with whether registrants can use them', () => {
    renderWithProviders(<PromoCodesSettings eventId="7" />);
    const [live] = screen.getAllByRole('table');
    const rows = within(live).getAllByRole('row');
    expect(within(rows[1]).getByText('EARLY')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Usable')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Each camper')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Off')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Expired')).toBeInTheDocument();
  });

  it('adds a code for the event', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromoCodesSettings eventId="7" />);
    await user.click(screen.getByRole('button', { name: 'Add promo code' }));
    await user.type(await screen.findByRole('textbox', { name: /Label/ }), 'Spring');
    await user.type(screen.getByRole('textbox', { name: /Code/ }), 'SPRING');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ event: '7', label: 'Spring', code: 'SPRING', pricing_logic: 0 }),
      expect.anything(),
    );
  });

  it('lists deleted codes to restore', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PromoCodesSettings eventId="7" />);
    expect(screen.getByText('Deleted promo codes')).toBeInTheDocument();
    expect(screen.getByText('Reggie')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore Mistake' }));
    expect(restore).toHaveBeenCalledWith(6, expect.anything());
  });

  it('is read-only for a Reporter', () => {
    renderWithProviders(
      <PermissionsProvider userRole="reporter">
        <PromoCodesSettings eventId="7" />
      </PermissionsProvider>,
    );
    expect(screen.getByText('EARLY')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add promo code' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /^Delete / })).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'View Early bird' })).toBeInTheDocument();
    expect(screen.queryByText('Deleted promo codes')).toBeNull();
  });
});
