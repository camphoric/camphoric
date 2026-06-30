import userEvent from '@testing-library/user-event';
import type { ApiRegisterPaymentStep } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentNeeded } from './PaymentNeeded';

const { navigate, submitMutate } = vi.hoisted(() => ({ navigate: vi.fn(), submitMutate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

// An event whose electronic total includes a 3% handling fee; paying by check
// recomputes without it.
const config = makeRegisterConfig({
  dataSchema: { title: 'Camp', definitions: { camper: { type: 'object', properties: {} } } },
  event: { is_open: true, epayment_handling: 3 },
  pricing: { fee: 100 },
  pricingLogic: { registration: [{ var: 'total', exp: { var: 'pricing.fee' } }], camper: [] },
});

vi.mock('store/registrationApi', () => ({
  useRegistrationConfig: () => ({ data: config }),
  useSubmitPayment: () => ({ mutate: submitMutate, isPending: false }),
}));

beforeEach(() => {
  submitMutate.mockClear();
  navigate.mockClear();
  useRegistrationStore.getState().reset();
});

describe('PaymentNeeded', () => {
  it('pays by check using the fee-free recomputed total', async () => {
    const user = userEvent.setup();
    useRegistrationStore.getState().setRegistration({ campers: [] });
    const paymentStep: ApiRegisterPaymentStep = {
      registrationUUID: 'uuid-1',
      serverPricingResults: { total: 103, handling: 3, campers: [] },
    };

    renderWithProviders(<PaymentNeeded eventId="1" paymentStep={paymentStep} />);

    // The displayed total is the electronic (with-fee) amount from the server.
    expect(screen.getByText('Total: $103.00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pay by check/ }));

    // Check omits the handling fee: the posted total is the fee-free 100.
    expect(submitMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationUUID: 'uuid-1',
        paymentType: 'Check',
        paymentData: { type: 'None', total: 100 },
      }),
      expect.any(Object),
    );
  });
});
