import userEvent from '@testing-library/user-event';
import type { ApiRegisterPaymentStep } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getRegistrationStorageKey,
  loadSentRegistration,
  saveSentRegistration,
} from '../../storage';
import { NoPayment } from '../NoPayment';

const { navigate, submitMutate } = vi.hoisted(() => ({
  navigate: vi.fn(),
  submitMutate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

const config = makeRegisterConfig({ dataSchema: { title: 'Camp' } });

vi.mock('store/registrationApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('store/registrationApi')>()),
  useRegistrationConfig: () => ({ data: config }),
  useSubmitPayment: () => ({ mutate: submitMutate, isPending: false }),
}));

const paymentStep: ApiRegisterPaymentStep = {
  registrationUUID: 'uuid-1',
  serverPricingResults: { total: 0, campers: [] },
  paymentOptions: { title: '', description: '', default: 'Full', options: [] },
  handlingPercent: null,
};

beforeEach(() => {
  navigate.mockClear();
  submitMutate.mockReset();
  localStorage.clear();
  useRegistrationStore.getState().reset();
});

describe('NoPayment', () => {
  it('goes back to the form when the server no longer has the registration (#769)', async () => {
    const user = userEvent.setup();
    const key = getRegistrationStorageKey('1', config);
    saveSentRegistration(key, { paymentStep, formData: { campers: [{}] }, promo: null });
    submitMutate.mockImplementation((_body: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(new ApiError(404, 'Not Found', { code: 'registration_not_found' })),
    );

    renderWithProviders(<NoPayment eventId="1" registrationUUID="uuid-1" />);
    await user.click(screen.getByRole('button', { name: 'Finish registration' }));

    expect(loadSentRegistration(key)).toBeNull();
    expect(useRegistrationStore.getState().sentNotFound).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
  });

  it('goes back to the form to choose again when the lodging has filled up', async () => {
    const user = userEvent.setup();
    submitMutate.mockImplementation((_body: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(
        new ApiError(409, 'Conflict', {
          code: 'lodging_unavailable',
          detail: 'There’s no room left in Cabin A.',
          reopen: 'sent-at',
        }),
      ),
    );

    renderWithProviders(<NoPayment eventId="1" registrationUUID="uuid-1" />);
    await user.click(screen.getByRole('button', { name: 'Finish registration' }));

    expect(useRegistrationStore.getState().lodgingProblem).toBe('There’s no room left in Cabin A.');
    expect(useRegistrationStore.getState().reopen).toBe('sent-at');
    expect(useRegistrationStore.getState().sentNotFound).toBe(false);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
  });

  it('sends back what the page was showing (DR-140)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NoPayment eventId="1" registrationUUID="uuid-1" quote="shown" />);
    await user.click(screen.getByRole('button', { name: 'Finish registration' }));

    expect(submitMutate).toHaveBeenCalledWith(
      { registrationUUID: 'uuid-1', quote: 'shown' },
      expect.any(Object),
    );
  });

  it('takes a new payment step, and says why, when something is now due (DR-140)', async () => {
    const user = userEvent.setup();
    const message = 'The amount due on your registration has changed.';
    const now = { ...paymentStep, serverPricingResults: { total: 100, campers: [] } };
    submitMutate.mockImplementation((_body: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(
        new ApiError(409, 'Conflict', {
          code: 'invoice_changed',
          detail: message,
          paymentStep: now,
        }),
      ),
    );

    renderWithProviders(<NoPayment eventId="1" registrationUUID="uuid-1" />);
    await user.click(screen.getByRole('button', { name: 'Finish registration' }));

    expect(useRegistrationStore.getState().paymentStep).toEqual(now);
    expect(useRegistrationStore.getState().paymentNotice).toBe(message);
  });

  it('says why when the server refuses to complete it (#803)', async () => {
    const user = userEvent.setup();
    submitMutate.mockImplementation((_body: unknown, options: { onError: (e: unknown) => void }) =>
      options.onError(
        new ApiError(409, 'Conflict', {
          code: 'invitation_redeemed',
          detail: 'Sorry, that invitation code has already been redeemed by another registration.',
        }),
      ),
    );

    renderWithProviders(<NoPayment eventId="1" registrationUUID="uuid-1" />);
    await user.click(screen.getByRole('button', { name: 'Finish registration' }));

    expect(
      screen.getByText(
        'Sorry, that invitation code has already been redeemed by another registration.',
      ),
    ).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
