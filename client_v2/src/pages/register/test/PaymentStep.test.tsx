import type { ApiRegisterPaymentStep } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentStep } from '../PaymentStep';
import { saveSentRegistration } from '../storage';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

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

vi.mock('store/registrationApi', () => ({ useRegistrationConfig: () => ({ data: config }) }));

const paymentStep: ApiRegisterPaymentStep = {
  registrationUUID: 'u',
  serverPricingResults: { total: 100, campers: [{ total: 100 }] },
  paymentOptions: { title: '', description: '', default: 'Full', options: [] },
  handlingPercent: null,
};

beforeEach(() => {
  navigate.mockClear();
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

  it('goes back to step 1 when nothing was sent', () => {
    renderWithProviders(<PaymentStep />);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
  });
});
