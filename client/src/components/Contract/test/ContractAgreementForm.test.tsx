import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { ContractAgreementForm } from '../ContractAgreementForm';
import { PUBLISHED_CONTRACT } from './contractFixtures';

function renderForm(props: Partial<Parameters<typeof ContractAgreementForm>[0]> = {}) {
  const onAgree = vi.fn();
  const onDecline = vi.fn();
  renderWithProviders(
    <ContractAgreementForm
      contract={PUBLISHED_CONTRACT}
      onAgree={onAgree}
      onDecline={onDecline}
      {...props}
    />,
  );
  return { onAgree, onDecline };
}

describe('ContractAgreementForm', () => {
  it('shows every section in order, with the version and its effective date', () => {
    renderForm();
    const sections = screen.getAllByRole('region');
    expect(sections.map((s) => s.getAttribute('aria-label'))).toEqual([
      'Privacy Policy',
      'Liability Waiver',
    ]);
    expect(screen.getByText(/Version 2, effective/)).toBeInTheDocument();
    expect(screen.getByText('PayPal', { selector: 'strong' })).toBeInTheDocument();
  });

  it('renders the Markdown sanitized', () => {
    renderForm();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(/Use it at your own risk/)).toBeInTheDocument();
  });

  it('says agreeing is required, and chooses nothing for them', () => {
    const { onAgree, onDecline } = renderForm();
    expect(screen.getByText(/If you don’t agree, you’ll be signed out/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(onAgree).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });

  it('agrees or declines, separately', async () => {
    const { onAgree, onDecline } = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'I agree' }));
    expect(onAgree).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /I don’t agree/ }));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('links to the public privacy policy', () => {
    renderForm();
    expect(screen.getByRole('link', { name: /privacy-policy/ })).toHaveAttribute(
      'href',
      '/organizations/3/privacy-policy',
    );
  });

  it('shows why agreeing failed', () => {
    renderForm({ error: 'These terms have changed since you opened them.' });
    expect(screen.getByRole('alert')).toHaveTextContent('These terms have changed');
  });
});
