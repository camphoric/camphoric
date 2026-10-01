import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { PromoCodeForm } from '../PromoCodeForm';
import { samplePromoCode } from './promoCodeFixtures';

// Monaco doesn't load in jsdom; a textarea stands in for the JSON editor.
vi.mock('components/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Discount logic"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function setup(props: Partial<Parameters<typeof PromoCodeForm>[0]> = {}) {
  const onSubmit = vi.fn();
  renderWithProviders(<PromoCodeForm onSubmit={onSubmit} onCancel={vi.fn()} {...props} />);
  return { onSubmit, user: userEvent.setup() };
}

const logic = () => screen.getByRole('textbox', { name: 'Discount logic' });

describe('PromoCodeForm', () => {
  it('adds a per-camper code', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByRole('textbox', { name: /Label/ }), 'Sibling discount');
    await user.type(screen.getByRole('textbox', { name: /Code/ }), ' sibling ');
    await user.click(screen.getByRole('radio', { name: 'For each camper' }));
    await user.clear(logic());
    // user.type treats braces as key names; paste the JSON instead.
    await user.click(logic());
    await user.paste('{"*": [{"var": "tuition"}, 0.5]}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      label: 'Sibling discount',
      code: 'sibling',
      pricing_logic: { '*': [{ var: 'tuition' }, 0.5] },
      scope: 'camper',
      enabled: true,
      expiration_date: null,
    });
  });

  it('edits a code, keeping what isn’t changed', async () => {
    const promoCode = samplePromoCode({ expiration_date: '2026-12-01T08:00:00.000Z' });
    const { onSubmit, user } = setup({ promoCode });
    expect(screen.getByRole('radio', { name: 'Once, for the registration' })).toBeChecked();
    await user.click(screen.getByRole('switch', { name: 'Registrants can use it' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      label: 'Early bird',
      code: 'EARLY',
      pricing_logic: promoCode.pricing_logic,
      scope: 'registration',
      enabled: false,
      expiration_date: '2026-12-01T08:00:00.000Z',
    });
  });

  it('won’t save invalid JSON or a missing label', async () => {
    const { onSubmit, user } = setup();
    await user.clear(logic());
    await user.click(logic());
    await user.paste('{ nope');
    expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.clear(logic());
    await user.click(logic());
    await user.paste('25');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Give the code a label')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the server’s field errors', () => {
    setup({ errors: { code: 'Another promo code already uses this code.' } });
    expect(screen.getByText('Another promo code already uses this code.')).toBeInTheDocument();
  });
});
