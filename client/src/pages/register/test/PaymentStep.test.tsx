import type { ApiRegisterPaymentStep } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentStep } from '../PaymentStep';
import { loadSentRegistration, saveSentRegistration } from '../storage';

const { navigate, refresh } = vi.hoisted(() => ({ navigate: vi.fn(), refresh: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

// The payment options aren't under test here: just the review above them.
vi.mock('../payment/PaymentNeeded', () => ({ PaymentNeeded: () => <p>Payment options</p> }));

const config = makeRegisterConfig({
  dataSchema: {
    title: 'Camp',
    type: 'object',
    properties: {
      registrant_email: { type: 'string', title: 'Email' },
      campers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            first_name: { type: 'string', title: 'First name' },
            last_name: { type: 'string', title: 'Last name' },
          },
        },
      },
    },
  },
  event: { is_open: true, start: { epoch: 0, year: 2026, month: 7, day: 1 } },
});

vi.mock('store/registrationApi', async (importOriginal) => ({
  registrationNotFound: (await importOriginal<typeof import('store/registrationApi')>())
    .registrationNotFound,
  useRegistrationConfig: () => ({ data: config }),
  useRefreshPaymentStep: () => ({ mutate: refresh }),
}));

const paymentStep: ApiRegisterPaymentStep = {
  registrationUUID: 'u',
  serverPricingResults: { total: 100, campers: [{ total: 100 }] },
  paymentOptions: { title: '', description: '', default: 'Full', options: [] },
  handlingPercent: null,
};

beforeEach(() => {
  navigate.mockClear();
  refresh.mockReset();
  useRegistrationStore.getState().reset();
  localStorage.clear();
});

describe('PaymentStep', () => {
  it('resumes a sent registration after a reload, still showing what was entered (#761)', () => {
    saveSentRegistration('Camp, 2026-7-1', {
      paymentStep,
      formData: {
        registrant_email: 'pat@example.com',
        campers: [{ first_name: 'Pat', last_name: 'Ames' }],
      },
      promo: null,
    });

    renderWithProviders(<PaymentStep />);

    expect(screen.getByText('pat@example.com')).toBeInTheDocument();
    expect(screen.getByText('1st Camper — Pat Ames')).toBeInTheDocument();
    expect(screen.getByText('Payment options')).toBeInTheDocument();
    expect(useRegistrationStore.getState().paymentStep).toEqual(paymentStep);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('asks the server for the payment step as it is now, and keeps it (DR-105)', () => {
    saveSentRegistration('Camp, 2026-7-1', {
      paymentStep,
      formData: { campers: [{ first_name: 'Pat' }] },
      promo: null,
    });
    // An organizer lowered the invoice: it's the one option now.
    const now: ApiRegisterPaymentStep = {
      ...paymentStep,
      paymentOptions: {
        title: '',
        description: '',
        default: 'invoice:7',
        options: [{ name: 'invoice:7', title: 'Full Payment', amount: 50, handling: 0 }],
      },
    };
    refresh.mockImplementation((_uuid: string, options: { onSuccess: (s: unknown) => void }) =>
      options.onSuccess(now),
    );

    renderWithProviders(<PaymentStep />);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('u', expect.any(Object));
    expect(useRegistrationStore.getState().paymentStep).toEqual(now);
    expect(loadSentRegistration('Camp, 2026-7-1')?.paymentStep).toEqual(now);
  });

  it('forgets a sent registration the server no longer has, and goes back to step 1 (#769)', () => {
    const formData = { campers: [{ first_name: 'Pat' }] };
    saveSentRegistration('Camp, 2026-7-1', { paymentStep, formData, promo: null });
    refresh.mockImplementation((_uuid: string, options: { onError: (e: unknown) => void }) =>
      options.onError(
        new ApiError(404, 'Not Found', {
          code: 'registration_not_found',
          detail: 'We couldn’t find your earlier registration. Please send the form again.',
        }),
      ),
    );

    renderWithProviders(<PaymentStep />);

    expect(loadSentRegistration('Camp, 2026-7-1')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
    const state = useRegistrationStore.getState();
    expect(state.sentNotFound).toBe(true);
    expect(state.registration).toEqual(formData);
  });

  it('keeps what was saved when asking again fails otherwise', () => {
    saveSentRegistration('Camp, 2026-7-1', {
      paymentStep,
      formData: { campers: [{ first_name: 'Pat' }] },
      promo: null,
    });
    refresh.mockImplementation((_uuid: string, options: { onError: (e: unknown) => void }) =>
      options.onError(new ApiError(500, 'Internal Server Error', null)),
    );

    renderWithProviders(<PaymentStep />);

    expect(loadSentRegistration('Camp, 2026-7-1')?.paymentStep).toEqual(paymentStep);
    expect(useRegistrationStore.getState().paymentStep).toEqual(paymentStep);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes back to step 1 when nothing was sent', () => {
    renderWithProviders(<PaymentStep />);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
  });
});
