import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { FeeBreakdown } from '../FeeBreakdown';
import { CAMPER_LOGIC, OVERRIDDEN, STALE_OVERRIDE, TUITION_OVERRIDE } from './fixtures';

describe('FeeBreakdown', () => {
  it('lists the lines, without actions when none are given', () => {
    renderWithProviders(<FeeBreakdown results={OVERRIDDEN} logics={[CAMPER_LOGIC]} />);
    expect(screen.getByText('Tuition')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says what an overridden line works out to, why, and who', () => {
    renderWithProviders(
      <FeeBreakdown results={OVERRIDDEN} logics={[CAMPER_LOGIC]} overrides={[TUITION_OVERRIDE]} />,
    );
    expect(
      screen.getByText(
        'Overridden (the pricing works out $920.00): Instructor’s kid — Reggie Registrar',
      ),
    ).toBeInTheDocument();
  });

  it('offers to override, change or remove a line', async () => {
    const onOverride = vi.fn();
    const onRemoveOverride = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FeeBreakdown
        results={OVERRIDDEN}
        logics={[CAMPER_LOGIC]}
        overrides={[TUITION_OVERRIDE]}
        overridable={['tuition', 'meals']}
        onOverride={onOverride}
        onRemoveOverride={onRemoveOverride}
      />,
    );
    // Parking isn't overridable here.
    expect(screen.queryByRole('button', { name: 'Override Parking' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Override Meals' }));
    expect(onOverride).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'meals', computed: 505, override: undefined }),
    );
    await user.click(screen.getByRole('button', { name: 'Change the override of Tuition' }));
    expect(onOverride).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'tuition', value: 500, computed: 920 }),
    );
    await user.click(screen.getByRole('button', { name: 'Remove the override of Tuition' }));
    expect(onRemoveOverride).toHaveBeenCalledWith(TUITION_OVERRIDE);
  });

  it('lists an override that isn’t in effect', () => {
    renderWithProviders(
      <FeeBreakdown results={OVERRIDDEN} logics={[CAMPER_LOGIC]} overrides={[STALE_OVERRIDE]} />,
    );
    expect(screen.getByText(/Not in effect: name_badge set to \$0\.00/)).toBeInTheDocument();
  });
});
