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
  PricingResults,
  RegistrationFormData,
} from 'api-types';
import { create } from 'zustand';

const emptyTotals: PricingResults = { total: 0, campers: [] };
const emptyRegistration: RegistrationFormData = { campers: [{}] };

/**
 * A registration this browser has sent (SPEC §7.1): the payment-step payload it
 * got back, with the form data and promo code it was sent with.
 */
export interface SentRegistration {
  paymentStep: ApiRegisterPaymentStep;
  formData: RegistrationFormData;
  promo: AppliedPromo | null;
}

export interface RegistrationState {
  registration: RegistrationFormData;
  totals: PricingResults;
  paymentStep?: ApiRegisterPaymentStep;
  confirmationStep?: ApiRegisterConfirmationStep;
  /** The promo code the registrant has applied, checked with the server (§7.1). */
  promo: AppliedPromo | null;
  updating: boolean;
  /** The server no longer has the registration this browser sent: step 1 says to send it again. */
  sentNotFound: boolean;
  /** Why it couldn't be completed: lodging filled up meanwhile, and step 1 says to choose again. */
  lodgingProblem: string | null;
  /** What the draft saves send to reopen the submission whose lodging filled up (§15, DR-142). */
  reopen: string | null;
  /** Why the payment step just changed: what's due did (§15, DR-105, DR-140). */
  paymentNotice: string | null;

  setRegistration: (registration: RegistrationFormData) => void;
  setTotals: (totals: PricingResults) => void;
  setUpdating: (updating: boolean) => void;
  setPaymentStep: (paymentStep: ApiRegisterPaymentStep, notice?: string) => void;
  setConfirmationStep: (confirmationStep: ApiRegisterConfirmationStep) => void;
  setPromo: (promo: AppliedPromo | null) => void;
  /** Go on with a registration already sent: what it was sent with, and its payment step. */
  resumeSent: (sent: SentRegistration) => void;
  /** The server no longer has the sent registration: drop its payment step, keep what was entered. */
  forgetSent: () => void;
  /** Its lodging filled up before it was completed: back to the form to choose again. */
  lodgingTaken: (message: string, reopen?: string) => void;
  reset: () => void;
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  registration: emptyRegistration,
  totals: emptyTotals,
  promo: null,
  updating: false,
  sentNotFound: false,
  lodgingProblem: null,
  reopen: null,
  paymentNotice: null,

  setRegistration: (registration) => set({ registration }),
  setTotals: (totals) => set({ totals }),
  setUpdating: (updating) => set({ updating }),
  setPaymentStep: (paymentStep, notice) =>
    set({
      paymentStep,
      sentNotFound: false,
      lodgingProblem: null,
      reopen: null,
      paymentNotice: notice ?? null,
    }),
  setConfirmationStep: (confirmationStep) => set({ confirmationStep }),
  setPromo: (promo) => set({ promo }),
  resumeSent: ({ paymentStep, formData, promo }) =>
    set({
      paymentStep,
      registration: formData,
      promo,
      totals: paymentStep.serverPricingResults,
      sentNotFound: false,
      lodgingProblem: null,
      reopen: null,
      paymentNotice: null,
    }),
  forgetSent: () =>
    set({
      paymentStep: undefined,
      sentNotFound: true,
      lodgingProblem: null,
      reopen: null,
      paymentNotice: null,
    }),
  lodgingTaken: (message, reopen) =>
    set({
      paymentStep: undefined,
      lodgingProblem: message,
      reopen: reopen ?? null,
      paymentNotice: null,
    }),
  reset: () =>
    set({
      registration: emptyRegistration,
      totals: emptyTotals,
      paymentStep: undefined,
      confirmationStep: undefined,
      promo: null,
      updating: false,
      sentNotFound: false,
      lodgingProblem: null,
      reopen: null,
      paymentNotice: null,
    }),
}));
