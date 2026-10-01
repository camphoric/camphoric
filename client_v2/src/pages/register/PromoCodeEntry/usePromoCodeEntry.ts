/**
 * State for the promo code field (SPEC §7.1; §15, DR-67). Applying a code
 * checks it with the server and, if it can be used, keeps it in the
 * registration store; the code stays applied only while the field holds it.
 * Before the form is submitted, `readyToSubmit` refuses a code that's been
 * typed but not applied, so an unchecked code never goes unnoticed.
 */

import type { AppliedPromo } from 'api-types';
import { useRef, useState } from 'react';
import { useRegistrationStore } from 'store/registration';
import { useCheckPromoCode } from 'store/registrationApi';
import { apiErrorMessage } from 'utils/fetch';

import type { PromoCodeEntryProps } from './PromoCodeEntry';

export const UNAPPLIED_MESSAGE = 'Apply this promo code, or clear it, before continuing.';

/** Codes are matched without regard to case or surrounding space, as the server does. */
export function isSameCode(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export interface PromoCodeEntryState {
  /** Props for `PromoCodeEntry`. */
  props: PromoCodeEntryProps;
  /** Whether the form may be submitted; if not, shows why and focuses the field. */
  readyToSubmit: () => boolean;
}

/** `onPromoChange` is told of each code applied or removed, to reprice. */
export function usePromoCodeEntry(
  eventId: string,
  onPromoChange: (promo: AppliedPromo | null) => void,
): PromoCodeEntryState {
  const applied = useRegistrationStore((state) => state.promo);
  const setPromo = useRegistrationStore((state) => state.setPromo);
  const check = useCheckPromoCode(eventId);
  const [value, setValue] = useState(applied?.code ?? '');
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const setApplied = (promo: AppliedPromo | null) => {
    setPromo(promo);
    onPromoChange(promo);
  };

  const handleChange = (next: string) => {
    setValue(next);
    setError(undefined);
    if (applied && !isSameCode(next, applied.code)) setApplied(null);
  };

  const handleApply = () => {
    const code = value.trim();
    if (!code) return;
    check.mutate(code, {
      onSuccess: (promo) => {
        setValue(promo.code);
        setError(undefined);
        setApplied(promo);
      },
      onError: (failure) => setError(apiErrorMessage(failure)),
    });
  };

  const handleRemove = () => {
    setValue('');
    setError(undefined);
    setApplied(null);
  };

  const readyToSubmit = () => {
    if (!value.trim() || (applied && isSameCode(value, applied.code))) return true;
    setError(UNAPPLIED_MESSAGE);
    inputRef.current?.focus();
    return false;
  };

  return {
    props: {
      value,
      applied,
      error,
      checking: check.isPending,
      onChange: handleChange,
      onApply: handleApply,
      onRemove: handleRemove,
      inputRef,
    },
    readyToSubmit,
  };
}
