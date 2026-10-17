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
  registrationNotFound: (await importOriginal<typeof import('store/registrationApi')>())
    .registrationNotFound,
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
});
