import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { PaymentsTotals } from '../PaymentsTotals';
import { EMPTY_TOTALS, TOTALS } from './fixtures';

const section = (name: string) => screen.getByRole('region', { name });
const row = (region: HTMLElement, label: string | RegExp) =>
  within(region).getByRole('row', { name: label });

describe('PaymentsTotals', () => {
  it('says what’s owed and received, and what of the balance is owed which way', () => {
    renderWithProviders(<PaymentsTotals totals={TOTALS} />);
    const summary = section('Owed and received');
    expect(row(summary, /Priced \(12 registrations\)/)).toHaveTextContent('$9,290.00');
    expect(row(summary, /^Owed/)).toHaveTextContent('$9,374.00');
    expect(row(summary, /Received/)).toHaveTextContent('$8,125.00');
    expect(row(summary, /Still owed/)).toHaveTextContent('$1,399.00');
    expect(row(summary, /no invoice asks for yet/)).toHaveTextContent('$400.00');
    expect(row(summary, /Refunds due/)).toHaveTextContent('$150.00');
  });

  it('lists each price line, credits as credits, and what no line accounts for', () => {
    renderWithProviders(<PaymentsTotals totals={TOTALS} />);
    const charges = section('Charges');
    expect(row(charges, /Campership\s*Campers\s*Credit/)).toHaveTextContent('-$300.00');
    expect(row(charges, /Promo code/)).toHaveTextContent('-$140.00');
    expect(row(charges, /Registration charges/)).toHaveTextContent('$200.00');
    expect(row(charges, /Other, not in a line/)).toHaveTextContent('-$50.00');
    expect(row(charges, /^Priced/)).toHaveTextContent('$9,290.00');
  });

  it('counts custom charges by type, and the cancellation fees kept', () => {
    renderWithProviders(<PaymentsTotals totals={TOTALS} />);
    const types = section('Custom charges by type');
    expect(within(types).getByText(/Cancellation fees kept: 2 — \$200\.00/)).toBeInTheDocument();
    expect(row(types, /Linens/)).toHaveTextContent('3$75.00');
    expect(row(types, /Cancellation fee/)).toHaveTextContent('2$200.00');
  });

  it('sums payments by type', () => {
    renderWithProviders(<PaymentsTotals totals={TOTALS} />);
    const payments = section('Payments by type');
    expect(row(payments, /PayPal/)).toHaveTextContent('PayPal5$3,700.001$200.00$3,500.00');
    expect(row(payments, /All types/)).toHaveTextContent('All types13$8,475.002$350.00$8,125.00');
  });

  it('sets the handling fees beside PayPal’s own', () => {
    renderWithProviders(<PaymentsTotals totals={TOTALS} />);
    const fees = section('Online payment fees');
    expect(row(fees, /^PayPal’s fees/)).toHaveTextContent('$97.43');
    expect(row(fees, /Handling less PayPal’s fees/)).toHaveTextContent('-$13.43');
  });

  it('says when there’s nothing yet, and leaves out an “other” of nothing', () => {
    renderWithProviders(<PaymentsTotals totals={EMPTY_TOTALS} />);
    expect(screen.getByText('No payments yet.')).toBeInTheDocument();
    expect(screen.getByText('No custom charges.')).toBeInTheDocument();
    expect(screen.queryByText('Other, not in a line')).toBeNull();
  });
});
