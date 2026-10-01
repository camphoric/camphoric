/**
 * The in-progress public registration — the ONLY genuine global client state
 * (SPEC §5, §7, DR-1). Server data never goes here; it lives in TanStack Query.
 *
 * This is the store shell; the registration flow (Phase 3) consumes it.
 */

import type {
  ApiRegisterConfirmationStep,
  ApiRegisterPaymentStep,
  AppliedPromo,
  InitialPaymentBody,
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import { create } from 'zustand';

const emptyTotals: PricingResults = { total: 0, campers: [] };
const emptyRegistration: RegistrationFormData = { campers: [{}] };

export interface RegistrationState {
  registration: RegistrationFormData;
  totals: PricingResults;
  paymentStep?: ApiRegisterPaymentStep;
  paymentInfo?: InitialPaymentBody;
  confirmationStep?: ApiRegisterConfirmationStep;
  /** The promo code the registrant has applied, checked with the server (§7.1). */
  promo: AppliedPromo | null;
  updating: boolean;

  setRegistration: (registration: RegistrationFormData) => void;
  setTotals: (totals: PricingResults) => void;
  setUpdating: (updating: boolean) => void;
  setPaymentStep: (paymentStep: ApiRegisterPaymentStep) => void;
  setPaymentInfo: (paymentInfo: InitialPaymentBody) => void;
  setConfirmationStep: (confirmationStep: ApiRegisterConfirmationStep) => void;
  setPromo: (promo: AppliedPromo | null) => void;
  reset: () => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  registration: emptyRegistration,
  totals: emptyTotals,
  promo: null,
  updating: false,

  setRegistration: (registration) => set({ registration }),
  setTotals: (totals) => set({ totals }),
  setUpdating: (updating) => set({ updating }),
  setPaymentStep: (paymentStep) => set({ paymentStep }),
  setPaymentInfo: (paymentInfo) => set({ paymentInfo }),
  setConfirmationStep: (confirmationStep) => set({ confirmationStep }),
  setPromo: (promo) => set({ promo }),
  reset: () =>
    set({
      registration: emptyRegistration,
      totals: emptyTotals,
      paymentStep: undefined,
      paymentInfo: undefined,
      confirmationStep: undefined,
      promo: null,
      updating: false,
    }),
}));
