import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { PayPalCheckout } from '../PayPalCheckout';

const script = vi.hoisted(() => ({ current: { isPending: true, isRejected: false } }));
vi.mock('@paypal/react-paypal-js', () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: () => <div>PayPal's buttons</div>,
  usePayPalScriptReducer: () => [script.current],
}));

function view() {
  renderWithProviders(<PayPalCheckout clientId="id" createOrder={vi.fn()} onApprove={vi.fn()} />);
}

describe('PayPalCheckout', () => {
  it('holds the buttons’ place while PayPal loads', () => {
    script.current = { isPending: true, isRejected: false };
    view();
    expect(screen.getByLabelText('Loading PayPal')).toBeInTheDocument();
    expect(screen.queryByText("PayPal's buttons")).not.toBeInTheDocument();
  });

  it('shows the buttons once PayPal has loaded', () => {
    script.current = { isPending: false, isRejected: false };
    view();
    expect(screen.getByText("PayPal's buttons")).toBeInTheDocument();
  });

  it('says online payment isn’t available when PayPal can’t load', () => {
    script.current = { isPending: false, isRejected: true };
    view();
    expect(screen.getByText('PayPal couldn’t load')).toBeInTheDocument();
    expect(screen.getByText(/Online payment isn’t available right now/)).toBeInTheDocument();
    expect(screen.queryByText("PayPal's buttons")).not.toBeInTheDocument();
  });
});
