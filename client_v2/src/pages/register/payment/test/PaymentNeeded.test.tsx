import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiRegisterPaymentStep } from 'api-types';
import type { PayPalCheckoutProps } from 'components/PayPalCheckout';
import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentNeeded } from '../PaymentNeeded';
import { DEPOSIT_OPTIONS } from '../PaymentOptions/test/fixtures';

const { navigate, submitMutate, createOrder, finishMutate, checkout } = vi.hoisted(() => ({
  navigate: vi.fn(),
  submitMutate: vi.fn(),
  createOrder: { mutateAsync: vi.fn(), isSuccess: false },
  finishMutate: vi.fn(),
  // The props PayPal's buttons were last rendered with, to drive their callbacks.
  checkout: { props: null as PayPalCheckoutProps | null },
}));

vi.mock('components/PayPalCheckout', () => ({
  PAYMENT_BUTTON_WIDTH: 750,
  PayPalCheckout: (props: PayPalCheckoutProps) => {
    checkout.props = props;
    return null;
  },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

const config = makeRegisterConfig({
  dataSchema: { title: 'Camp', definitions: { camper: { type: 'object', properties: {} } } },
  event: { is_open: true, epayment_handling: 2.5 },
  payPalOptions: { clientId: 'test-client' },
});

vi.mock('store/registrationApi', async (importOriginal) => ({
  paymentProblem: (await importOriginal<typeof import('store/registrationApi')>()).paymentProblem,
  useRegistrationConfig: () => ({ data: config }),
  useSubmitPayment: () => ({ mutate: submitMutate, isPending: false }),
  useCreatePayPalOrder: () => createOrder,
  useFinishRegistration: () => ({ mutate: finishMutate, isPending: false }),
}));

const paymentStep: ApiRegisterPaymentStep = {
  registrationUUID: 'uuid-1',
  serverPricingResults: { total: 1000, campers: [] },
  paymentOptions: DEPOSIT_OPTIONS,
  handlingPercent: 2.5,
};

const problem = (code: string, detail: string) => new ApiError(409, 'Conflict', { code, detail });

/** The payment step fails with `error`. */
const failWith = (error: ApiError) =>
  submitMutate.mockImplementation((_body: unknown, options: { onError: (e: unknown) => void }) =>
    options.onError(error),
  );

beforeEach(() => {
  submitMutate.mockReset();
  finishMutate.mockReset();
  createOrder.mutateAsync.mockReset();
  createOrder.isSuccess = false;
  navigate.mockClear();
  checkout.props = null;
  useRegistrationStore.getState().reset();
});

function renderPage() {
  renderWithProviders(<PaymentNeeded eventId="1" paymentStep={paymentStep} />);
  if (!checkout.props) throw new Error('PayPal buttons not rendered');
  return checkout.props;
}

describe('PaymentNeeded', () => {
  it('pays by check with the chosen option, by name', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('radio', { name: '50% Deposit: $550.00' }));
    await user.click(screen.getByRole('button', { name: 'Pay $550.00 by check' }));

    expect(submitMutate).toHaveBeenCalledWith(
      { registrationUUID: 'uuid-1', paymentType: 'Check', paymentOption: '50% Deposit' },
      expect.any(Object),
    );
  });

  it('shows the online total, with its handling fee', () => {
    renderPage();
    expect(screen.getByText(/Pay \$1,025\.00 online/)).toBeInTheDocument();
  });

  it('asks the server for the PayPal order, for the chosen option', async () => {
    const props = renderPage();
    createOrder.mutateAsync.mockResolvedValue({ orderID: 'ORDER-1' });
    let orderId = '';
    await act(async () => {
      orderId = await props.createOrder('Card');
    });
    expect(orderId).toBe('ORDER-1');
    expect(createOrder.mutateAsync).toHaveBeenCalledWith({
      registrationUUID: 'uuid-1',
      paymentType: 'Card',
      paymentOption: 'Full Payment',
    });
    // PayPal's own checkout is open: the page isn't blocked (#646).
    expect(document.querySelector('.mantine-LoadingOverlay-root')).not.toBeInTheDocument();
  });

  it('hands the approved order to the server to capture', () => {
    const props = renderPage();
    act(() => props.onApprove('ORDER-1', 'PayPal'));
    expect(submitMutate).toHaveBeenCalledWith(
      { registrationUUID: 'uuid-1', paymentType: 'PayPal', paypalOrderId: 'ORDER-1' },
      expect.any(Object),
    );
  });

  it('after a cancelled PayPal window, says they’re registered and offers to finish', async () => {
    const user = userEvent.setup();
    const props = renderPage();
    createOrder.isSuccess = true;
    act(() => props.onCancel!());

    expect(
      screen.getByText(/You’re registered — your payment didn’t go through/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$1,000\.00 is still due/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish and pay later' }));
    expect(finishMutate).toHaveBeenCalledWith('uuid-1', expect.any(Object));
  });

  it('says why a capture was declined, and still offers check', () => {
    const props = renderPage();
    failWith(problem('declined', 'PayPal declined this payment.'));
    act(() => props.onApprove('ORDER-1', 'PayPal'));
    expect(screen.getByText('PayPal declined this payment.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /by check/ })).toBeInTheDocument();
  });

  it('when PayPal’s answer is lost, asks them not to pay again', () => {
    const props = renderPage();
    failWith(problem('unknown', 'PayPal had a problem'));
    act(() => props.onApprove('ORDER-1', 'PayPal'));
    expect(screen.getByText(/Please\s+don’t pay again/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /by check/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
  });

  it('shows the server’s reason when it can’t start a PayPal payment', async () => {
    const props = renderPage();
    createOrder.mutateAsync.mockRejectedValue(
      problem('not_configured', 'This event doesn’t take payments online.'),
    );
    await act(async () => {
      await props.createOrder('PayPal').catch(() => undefined);
    });
    expect(screen.getByText('This event doesn’t take payments online.')).toBeInTheDocument();
  });
});
