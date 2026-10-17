import type { ApiInvoicePay } from 'api-types';
import type { PayPalCheckoutProps } from 'components/PayPalCheckout';
import { act } from 'react';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvoicePayPage } from '../InvoicePayPage';
import { CANCELLED, DUE, NOT_ONLINE, PAID } from './fixtures';

const { state, createOrder, capture, checkout } = vi.hoisted(() => ({
  state: { page: null as ApiInvoicePay | null, isError: false },
  createOrder: { mutateAsync: vi.fn() },
  capture: { mutate: vi.fn(), isPending: false },
  checkout: { props: null as PayPalCheckoutProps | null },
}));

vi.mock('@tanstack/react-router', () => ({ useParams: () => ({ token: 'abc' }) }));
vi.mock('components/PayPalCheckout', () => ({
  PayPalCheckout: (props: PayPalCheckoutProps) => {
    checkout.props = props;
    return <div>PayPal buttons</div>;
  },
}));
vi.mock('store/invoicePay', async (importOriginal) => ({
  invoicePayProblem: (await importOriginal<typeof import('store/invoicePay')>()).invoicePayProblem,
  useInvoicePay: () => ({ data: state.page, isLoading: false, isError: state.isError }),
  useCreateInvoiceOrder: () => createOrder,
  useCaptureInvoiceOrder: () => capture,
}));

beforeEach(() => {
  state.page = DUE;
  state.isError = false;
  checkout.props = null;
  createOrder.mutateAsync.mockReset();
  capture.mutate.mockReset();
});

describe('InvoicePayPage', () => {
  it('shows the invoice and what paying online costs', () => {
    renderWithProviders(<InvoicePayPage />);
    expect(screen.getByText('Lark Camp 2027')).toBeInTheDocument();
    expect(screen.getByText(/Bob R\., Jane R\./)).toBeInTheDocument();
    expect(screen.getByText(/Pay \$1,460\.63 online/)).toBeInTheDocument();
    expect(screen.getByText('PayPal buttons')).toBeInTheDocument();
  });

  it('asks the server for the order and hands the approval back to capture', async () => {
    renderWithProviders(<InvoicePayPage />);
    createOrder.mutateAsync.mockResolvedValue({ orderID: 'ORDER-1' });
    let orderId = '';
    await act(async () => {
      orderId = await checkout.props!.createOrder('Card');
    });
    expect(orderId).toBe('ORDER-1');
    expect(createOrder.mutateAsync).toHaveBeenCalledWith('Card');
    act(() => checkout.props!.onApprove('ORDER-1', 'Card'));
    expect(capture.mutate).toHaveBeenCalledWith(
      { orderID: 'ORDER-1', paymentType: 'Card' },
      expect.any(Object),
    );
  });

  it('when PayPal’s answer is lost, asks them not to pay again', () => {
    capture.mutate.mockImplementation(
      (_body: unknown, options: { onError: (e: unknown) => void }) =>
        options.onError(new ApiError(502, 'Bad Gateway', { ...DUE, code: 'unknown', detail: 'x' })),
    );
    renderWithProviders(<InvoicePayPage />);
    act(() => checkout.props!.onApprove('ORDER-1', 'PayPal'));
    expect(screen.getByText(/Please don’t pay again/)).toBeInTheDocument();
    expect(screen.queryByText('PayPal buttons')).toBeNull();
  });

  it('says when it’s paid, cancelled, or can’t be paid online', () => {
    state.page = PAID;
    const { unmount } = renderWithProviders(<InvoicePayPage />);
    expect(screen.getByText('This invoice is paid. Thank you!')).toBeInTheDocument();
    expect(screen.queryByText('PayPal buttons')).toBeNull();
    unmount();

    state.page = CANCELLED;
    const cancelled = renderWithProviders(<InvoicePayPage />);
    expect(screen.getByText(/has been cancelled/)).toBeInTheDocument();
    cancelled.unmount();

    state.page = NOT_ONLINE;
    renderWithProviders(<InvoicePayPage />);
    expect(screen.getByText(/can’t be paid online/)).toBeInTheDocument();
  });

  it('says so when the link leads nowhere', () => {
    state.page = null;
    state.isError = true;
    renderWithProviders(<InvoicePayPage />);
    expect(screen.getByText('Invoice not found')).toBeInTheDocument();
  });
});
