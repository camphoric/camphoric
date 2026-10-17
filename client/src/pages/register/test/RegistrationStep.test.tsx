import userEvent from '@testing-library/user-event';
import type { ApiRegisterPaymentStep, AppliedPromo } from 'api-types';
import { calculatePrice } from 'pricing';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { act, renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RegistrationStep } from '../RegistrationStep';

const { checkMutate, useCheckPromoCode, checkSent, sentCheck } = vi.hoisted(() => {
  const checkMutate = vi.fn();
  return {
    checkMutate,
    useCheckPromoCode: vi.fn(() => ({ mutate: checkMutate, isPending: false })),
    checkSent: vi.fn<
      (
        uuid: string,
        options: {
          onSuccess: (paymentStep: ApiRegisterPaymentStep) => void;
          onError?: (error: unknown) => void;
        },
      ) => void
    >(),
    sentCheck: { pending: false },
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
  useCheckSentRegistration: () => ({
    mutate: checkSent,
    isPending: sentCheck.pending,
  }),
}));

beforeEach(() => {
  checkMutate.mockReset();
  checkSent.mockReset();
  sentCheck.pending = false;
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

  describe('a sent registration saved under the legacy key', () => {
    const LEGACY = 'Camp, '; // The fixture's event has no start date.
    const paymentStep = (total: number) => ({
      registrationUUID: 'u',
      serverPricingResults: { total, campers: [] },
      paymentOptions: { title: '', description: '', default: 'Full', options: [] },
      handlingPercent: null,
    });
    const legacy = { paymentStep: paymentStep(100), formData: { campers: [] }, promo: null };

    beforeEach(() => {
      localStorage.setItem(`${LEGACY} (payment)`, JSON.stringify(legacy));
    });

    it('is offered, under the new key, once the server confirms it’s this event’s', () => {
      checkSent.mockImplementation((_uuid, { onSuccess }) => onSuccess(paymentStep(80)));
      renderWithProviders(<RegistrationStep />);

      expect(checkSent).toHaveBeenCalledWith('u', expect.any(Object));
      expect(screen.getByText('You’ve already sent this registration')).toBeInTheDocument();
      expect(localStorage.getItem(`${LEGACY} (payment)`)).toBeNull();
      expect(JSON.parse(localStorage.getItem('Event 1: Camp,  (payment)') ?? '{}')).toEqual({
        ...legacy,
        paymentStep: paymentStep(80),
      });
    });

    it('holds back sending the form while it’s being checked', () => {
      sentCheck.pending = true;
      renderWithProviders(<RegistrationStep />);
      expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
    });

    it('is left alone when the server says it’s another event’s', () => {
      checkSent.mockImplementation((_uuid, { onError }) => onError?.(new Error('404')));
      renderWithProviders(<RegistrationStep />);

      expect(screen.queryByText('You’ve already sent this registration')).toBeNull();
      expect(localStorage.getItem(`${LEGACY} (payment)`)).not.toBeNull();
      expect(localStorage.getItem('Event 1: Camp,  (payment)')).toBeNull();
    });

    it('is cleared on starting over', async () => {
      const user = userEvent.setup();
      checkSent.mockImplementation((_uuid, { onSuccess }) => onSuccess(paymentStep(80)));
      localStorage.setItem(LEGACY, '{"campers":[]}');
      renderWithProviders(<RegistrationStep />);

      await user.click(screen.getByRole('button', { name: 'Start a new registration' }));

      expect(localStorage.getItem(LEGACY)).toBeNull();
      expect(localStorage.getItem(`${LEGACY} (payment)`)).toBeNull();
      expect(localStorage.getItem('Event 1: Camp, ')).toBeNull();
      expect(localStorage.getItem('Event 1: Camp,  (payment)')).toBeNull();
    });
  });
});
