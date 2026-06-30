/**
 * Admin data hooks built on the augmented view models (SPEC §5, §8.4, §8.5).
 * They fetch the full per-event entity sets (client-side scale — DR-25) and
 * memoize the derived lookups from cached query data. The pure builders live in
 * `store/augmented.ts`.
 */

import type { AugmentedRegistration, RegistrationTypeLookup } from 'api-types';
import { useMemo } from 'react';
import { buildRegistrationLookup, buildRegistrationTypeLookup } from 'store/augmented';
import {
  camperHooks,
  paymentHooks,
  registrationHooks,
  registrationTypeHooks,
} from 'store/entities';

/** The event's registration types, keyed by id. */
export function useRegistrationTypeLookup(eventId: string): RegistrationTypeLookup | undefined {
  const { data: registrationTypes } = registrationTypeHooks.useList({ event: eventId });
  return useMemo(
    () => (registrationTypes ? buildRegistrationTypeLookup(registrationTypes) : undefined),
    [registrationTypes],
  );
}

/**
 * The event's completed registrations, augmented with campers, registration
 * type, and money totals. Returns undefined until the dependencies have loaded.
 */
export function useAugmentedRegistrations(eventId: string): AugmentedRegistration[] | undefined {
  const { data: registrations } = registrationHooks.useList({ completed: 1, event: eventId });
  const { data: campers } = camperHooks.useList({
    registration__completed: 1,
    registration__event: eventId,
  });
  const { data: payments } = paymentHooks.useList({
    registration__completed: 1,
    registration__event: eventId,
  });
  const registrationTypeLookup = useRegistrationTypeLookup(eventId);

  return useMemo(() => {
    if (!registrations || !campers || !payments || !registrationTypeLookup) return undefined;
    const lookup = buildRegistrationLookup(
      registrations,
      campers,
      payments,
      registrationTypeLookup,
      eventId,
    );
    return Object.values(lookup);
  }, [registrations, campers, payments, registrationTypeLookup, eventId]);
}
