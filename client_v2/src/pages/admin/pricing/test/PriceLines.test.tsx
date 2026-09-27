import userEvent from '@testing-library/user-event';
import type { ApiCamper, ApiEvent, Role } from 'api-types';
import {
  CAMPER_LOGIC,
  HANDLING_WAIVED,
  OVERRIDDEN,
  REGISTRATION_LOGIC,
  TUITION_OVERRIDE,
} from 'components/FeeBreakdown/test/fixtures';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { overridableLines, PriceLines } from '../PriceLines';

const { create, update, remove, overrides } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  overrides: { current: [] as unknown[] },
}));

vi.mock('store/entities', () => ({
  pricingOverrideHooks: {
    useList: () => ({ data: overrides.current }),
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutate: update, isPending: false }),
    useDelete: () => ({ mutate: remove }),
  },
}));
vi.mock('store/deletes', async () => (await import('test/deletes')).mockDeletes);

const event = {
  camper_pricing_logic: CAMPER_LOGIC,
  registration_pricing_logic: REGISTRATION_LOGIC,
  epayment_handling: '2.50',
} as unknown as ApiEvent;
const camper = { id: 17, registration: 5 } as unknown as ApiCamper;

function setupCamper(role: Role = 'registrar') {
  renderWithProviders(
    <PermissionsProvider userRole={role}>
      <PriceLines
        event={event}
        results={OVERRIDDEN}
        logics={[CAMPER_LOGIC]}
        registrationId={5}
        camper={camper}
      />
    </PermissionsProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  create.mockClear();
  update.mockClear();
  remove.mockClear();
  overrides.current = [TUITION_OVERRIDE];
});

describe('PriceLines', () => {
  it('overrides a camper’s line with an amount and a reason', async () => {
    const user = setupCamper();
    await user.click(screen.getByRole('button', { name: 'Override Meals' }));
    expect(await screen.findByText(/The pricing works out \$505\.00/)).toBeInTheDocument();
    const override = screen.getByRole('button', { name: 'Override' });
    expect(override).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Amount' }), '300');
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'Food trade');
    await user.click(override);
    expect(create).toHaveBeenCalledWith(
      { registration: 5, camper: 17, var: 'meals', amount: 300, reason: 'Food trade' },
      expect.anything(),
    );
  });

  it('changes an existing override', async () => {
    const user = setupCamper();
    await user.click(screen.getByRole('button', { name: 'Change the override of Tuition' }));
    const amount = await screen.findByRole('textbox', { name: 'Amount' });
    await user.clear(amount);
    await user.type(amount, '450');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(
      { id: 2, amount: 450, reason: 'Instructor’s kid' },
      expect.anything(),
    );
  });

  it('removes one after confirming', async () => {
    const user = setupCamper();
    await user.click(screen.getByRole('button', { name: 'Remove the override of Tuition' }));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(remove).toHaveBeenCalledWith({ id: 2 });
  });

  it('shows a Reporter the override, with no actions', () => {
    setupCamper('reporter');
    expect(screen.getByText(/Overridden \(the pricing works out \$920\.00\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('overrides only the registration’s own lines on the registration', () => {
    overrides.current = [];
    renderWithProviders(
      <PriceLines
        event={event}
        results={{ ...HANDLING_WAIVED, tuition: 1840 }}
        logics={[REGISTRATION_LOGIC, CAMPER_LOGIC]}
        registrationId={5}
      />,
    );
    expect(screen.getByRole('button', { name: 'Override Donation' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Override Electronic payment handling' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Override Tuition' })).toBeNull();
    expect(screen.getByText(/overridden on each camper’s Fees tab/)).toBeInTheDocument();
  });
});

describe('overridableLines', () => {
  it('is every line but the total, and the handling fee when there is one', () => {
    expect(overridableLines(event, true)).toEqual(['tuition', 'meals', 'parking']);
    expect(overridableLines(event, false)).toEqual(['donation', 'handling']);
    expect(overridableLines({ ...event, epayment_handling: 0 }, false)).toEqual(['donation']);
  });
});
