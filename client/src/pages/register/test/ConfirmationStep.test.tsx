import { useRegistrationStore } from 'store/registration';
import { makeRegisterConfig } from 'test/fixtures';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationStep } from '../ConfirmationStep';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ eventId: '1' }),
}));

const config = makeRegisterConfig({
  dataSchema: { title: 'Camp' },
  event: { is_open: true, start: { epoch: 0, year: 2026, month: 7, day: 1 } },
});

vi.mock('store/registrationApi', () => ({ useRegistrationConfig: () => ({ data: config }) }));

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockClear();
  useRegistrationStore.getState().reset();
  localStorage.clear();
});

/** Puts a paid-for registration and its confirmation page in the store. */
function confirm() {
  const store = useRegistrationStore.getState();
  store.setPaymentStep({
    registrationUUID: 'u',
    serverPricingResults: { total: 100, campers: [] },
    paymentOptions: { title: '', description: '', default: 'Full', options: [] },
    handlingPercent: null,
  });
  store.setConfirmationStep({
    confirmationPage: 'Thanks, **paid by Check**! <img src=x onerror="alert(1)">',
    serverPricingResults: { total: 100, campers: [] },
    invoice: null,
    ledger: {
      price: 100,
      handling_charges: 0,
      total_owed: 100,
      total_paid: 0,
      balance: 100,
      uninvoiced_balance: 0,
    },
  });
}

describe('ConfirmationStep', () => {
  it('shows the page the server rendered and clears saved data', () => {
    confirm();
    localStorage.setItem('Event 1: Camp, 2026-7-1', '{"campers":[{}]}');
    localStorage.setItem('Event 1: Camp, 2026-7-1 (payment)', '{"paymentOptions":{}}');

    renderWithProviders(<ConfirmationStep />);

    // The server's markdown is shown as sanitized HTML.
    expect(screen.getByText('paid by Check').tagName).toBe('STRONG');
    expect(document.querySelector('[onerror]')).toBeNull();
    // Saved form data, and the saved payment step, are cleared.
    expect(localStorage.getItem('Event 1: Camp, 2026-7-1')).toBeNull();
    expect(localStorage.getItem('Event 1: Camp, 2026-7-1 (payment)')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  describe('data saved under the key without the event id', () => {
    const sent = (registrationUUID: string) =>
      JSON.stringify({
        paymentStep: { registrationUUID, paymentOptions: { options: [] } },
        formData: { campers: [] },
      });

    it('is cleared too, the sent registration only when it’s this one', () => {
      confirm();
      localStorage.setItem('Event 1: Camp, 2026-7-1 (payment)', sent('u'));
      localStorage.setItem('Camp, 2026-7-1', '{"campers":[{}]}');
      localStorage.setItem('Camp, 2026-7-1 (payment)', sent('u'));

      renderWithProviders(<ConfirmationStep />);

      expect(localStorage.getItem('Camp, 2026-7-1')).toBeNull();
      expect(localStorage.getItem('Camp, 2026-7-1 (payment)')).toBeNull();
    });

    it('keeps a sent registration that another event with the same title saved', () => {
      confirm();
      localStorage.setItem('Event 1: Camp, 2026-7-1 (payment)', sent('u'));
      localStorage.setItem('Camp, 2026-7-1 (payment)', sent('other'));

      renderWithProviders(<ConfirmationStep />);

      expect(localStorage.getItem('Camp, 2026-7-1 (payment)')).toBe(sent('other'));
    });
  });

  it('still shows the page when site data is blocked', () => {
    confirm();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError');
    });

    renderWithProviders(<ConfirmationStep />);

    expect(screen.getByText('paid by Check')).toBeInTheDocument();
  });

  it('redirects to step 1 when there is no confirmation data', () => {
    renderWithProviders(<ConfirmationStep />);
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/events/$eventId/register/registration' }),
    );
  });
});
