import userEvent from '@testing-library/user-event';
import type { AppliedPromo } from 'api-types';
import { calculatePrice } from 'pricing';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { act, renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationStep } from '../RegistrationStep';

const { checkMutate, useCheckPromoCode } = vi.hoisted(() => {
  const checkMutate = vi.fn();
  return {
    checkMutate,
    useCheckPromoCode: vi.fn(() => ({ mutate: checkMutate, isPending: false })),
  };
});

vi.mock('pricing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pricing')>();
  return { ...actual, calculatePrice: vi.fn(actual.calculatePrice) };
});

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ eventId: '1' }),
}));

const INVITATION = {
  recipient_name: 'Sam',
  recipient_email: 'sam@example.com',
  invitation_code: 'ABC123',
};

const config = makeRegisterConfig({
  dataSchema: {
    title: 'Camp',
    type: 'object',
    properties: { registrant_email: { type: 'string', title: 'Email' } },
  },
  invitation: INVITATION,
  registrationType: { name: 'staff', label: 'Staff' },
  hasPromoCodes: true,
});

vi.mock('store/registrationApi', () => ({
  useRegistrationConfig: () => ({ data: config }),
  useSubmitRegistration: () => ({ mutate: vi.fn(), isPending: false }),
  useCheckPromoCode,
}));

beforeEach(() => {
  checkMutate.mockReset();
  useCheckPromoCode.mockClear();
  useRegistrationStore.getState().reset();
  localStorage.clear();
});

describe('RegistrationStep', () => {
  it('checks a promo code for the registrant’s invitation (§15, DR-107)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegistrationStep />);
    await user.type(screen.getByRole('textbox', { name: 'Promo code' }), 'spring');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(useCheckPromoCode).toHaveBeenLastCalledWith('1', INVITATION);
    expect(checkMutate).toHaveBeenCalledWith('spring', expect.any(Object));
  });

  it('prices an applied promo code against the form as it is when the check returns', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegistrationStep />);
    await user.type(screen.getByRole('textbox', { name: 'Promo code' }), 'spring');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    const [, { onSuccess }] = checkMutate.mock.lastCall as [
      string,
      { onSuccess: (promo: AppliedPromo) => void },
    ];

    // The registrant edits the form while the code is being checked.
    const edited = { registrant_email: 'pat@example.com', campers: [] };
    act(() => useRegistrationStore.getState().setRegistration(edited));
    const promo: AppliedPromo = {
      code: 'SPRING',
      label: 'Spring',
      scope: 'registration',
      pricingLogic: null,
    };
    act(() => onSuccess(promo));

    expect(calculatePrice).toHaveBeenLastCalledWith(config, edited, promo);
  });
});
