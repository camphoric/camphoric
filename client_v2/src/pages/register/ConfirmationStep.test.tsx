import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import type { ApiRegister } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationStep } from './ConfirmationStep';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

const config = {
  dataSchema: { title: 'Camp' },
  event: { is_open: true, start: { epoch: 0, year: 2026, month: 7, day: 1 } },
} as unknown as ApiRegister;

vi.mock('store/registrationApi', () => ({ useRegistrationConfig: () => ({ data: config }) }));

beforeEach(() => {
  navigate.mockClear();
  useRegistrationStore.getState().reset();
  localStorage.clear();
});

describe('ConfirmationStep', () => {
  it('renders the confirmation template and clears saved data', () => {
    const store = useRegistrationStore.getState();
    store.setPaymentStep({ registrationUUID: 'u', serverPricingResults: { total: 100, campers: [] } });
    store.setPaymentInfo({
      registrationUUID: 'u',
      paymentType: 'Check',
      paymentData: { type: 'none', total: 100 },
    });
    store.setConfirmationStep({
      confirmationPageTemplate: 'Thanks **{{paymentInfo.paymentType}}**!',
      serverPricingResults: { total: 100, campers: [] },
      initialPayment: {},
    });
    localStorage.setItem('Camp, 2026-7-1', '{"campers":[{}]}');

    render(
      <MantineProvider>
        <ConfirmationStep />
      </MantineProvider>,
    );

    // Template renders with the variable bundle (paymentInfo.paymentType = Check).
    expect(screen.getByText('Check')).toBeInTheDocument();
    // Saved form data is cleared.
    expect(localStorage.getItem('Camp, 2026-7-1')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects to step 1 when there is no confirmation data', () => {
    render(
      <MantineProvider>
        <ConfirmationStep />
      </MantineProvider>,
    );
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
  });
});
