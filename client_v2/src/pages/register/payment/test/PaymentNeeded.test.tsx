import type { PayPalButtonsComponentProps } from '@paypal/react-paypal-js';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiRegisterPaymentStep } from 'api-types';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentNeeded } from '../PaymentNeeded';

const { navigate, submitMutate, buttons } = vi.hoisted(() => ({
  navigate: vi.fn(),
  submitMutate: vi.fn(),
  // The props the PayPal buttons were last rendered with, to drive their callbacks.
  buttons: { props: null as PayPalButtonsComponentProps | null },
}));

vi.mock('@paypal/react-paypal-js', () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: (props: PayPalButtonsComponentProps) => {
    buttons.props = props;
    return null;
  },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

// An event whose electronic total includes a 3% handling fee; paying by check
// recomputes without it.
const config = makeRegisterConfig({
  dataSchema: { title: 'Camp', definitions: { camper: { type: 'object', properties: {} } } },
  event: { is_open: true, epayment_handling: 3 },
  payPalOptions: { clientId: 'test-client' },
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
  buttons.props = null;
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

  describe('PayPal buttons', () => {
    const paymentStep: ApiRegisterPaymentStep = {
      registrationUUID: 'uuid-1',
      serverPricingResults: { total: 103, handling: 3, campers: [] },
    };
    const overlay = () => document.querySelector('.mantine-LoadingOverlay-root');

    function renderButtons() {
      useRegistrationStore.getState().setRegistration({ campers: [] });
      renderWithProviders(<PaymentNeeded eventId="1" paymentStep={paymentStep} />);
      if (!buttons.props) throw new Error('PayPal buttons not rendered');
      return buttons.props;
    }

    // Click one of PayPal's buttons ('paypal', 'card', …).
    async function click(props: PayPalButtonsComponentProps, fundingSource: string) {
      await act(async () => {
        await props.onClick!({ fundingSource }, {} as never);
      });
    }

    // Approve an order PayPal captured for $103.
    async function approve(props: PayPalButtonsComponentProps) {
      const capture = vi.fn().mockResolvedValue({
        purchase_units: [{ amount: { value: '103.00' }, custom_id: 'None' }],
      });
      await act(() => props.onApprove!({} as never, { order: { capture } } as never));
    }

    it('leaves the page usable while PayPal’s own checkout is open (#646)', async () => {
      const props = renderButtons();
      const create = vi.fn().mockResolvedValue('order-1');
      await click(props, 'card');
      await act(() => props.createOrder!({ paymentSource: 'card' }, { order: { create } }));

      expect(create).toHaveBeenCalled();
      expect(overlay()).not.toBeInTheDocument();
    });

    it('records a card payment from the Debit or Credit Card button', async () => {
      const props = renderButtons();
      await click(props, 'card');
      await approve(props);

      expect(submitMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentType: 'Card',
          paymentData: { type: 'None', total: 103 },
        }),
        expect.any(Object),
      );
    });

    it('records a PayPal payment from the PayPal button', async () => {
      const props = renderButtons();
      await click(props, 'paypal');
      await approve(props);

      expect(submitMutate).toHaveBeenCalledWith(
        expect.objectContaining({ paymentType: 'PayPal' }),
        expect.any(Object),
      );
    });

    it('says so and unblocks the page when PayPal fails', () => {
      const props = renderButtons();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      act(() => props.onError!({ message: 'boom' }));

      expect(screen.getByText(/PayPal ran into a problem/)).toBeInTheDocument();
      expect(overlay()).not.toBeInTheDocument();
    });

    it('says so and unblocks the page when the capture fails', async () => {
      const props = renderButtons();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const capture = vi.fn().mockRejectedValue(new Error('declined'));
      await act(() => props.onApprove!({} as never, { order: { capture } } as never));

      expect(screen.getByText(/couldn’t be completed/)).toBeInTheDocument();
      expect(submitMutate).not.toHaveBeenCalled();
      expect(overlay()).not.toBeInTheDocument();
    });
  });
});
