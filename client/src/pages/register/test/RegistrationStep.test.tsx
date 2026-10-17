import userEvent from '@testing-library/user-event';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationStep } from '../RegistrationStep';

const { checkMutate, useCheckPromoCode } = vi.hoisted(() => {
  const checkMutate = vi.fn();
  return {
    checkMutate,
    useCheckPromoCode: vi.fn(() => ({ mutate: checkMutate, isPending: false })),
  };
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
});
