/**
 * Hooks that fetch the per-event entity sets and assemble the augmented view
 * models and the report template-variable bundle (SPEC §5, §8.7). The derivation
 * is memoized from cached query data; the pure builders live in
 * `store/augmented.ts`.
 */

import type { ReportTemplateVars } from 'api-types';
import { useMemo } from 'react';
import {
  buildCamperLookup,
  buildLodgingTree,
  buildRegistrationLookup,
  buildRegistrationTypeLookup,
  flattenLodgingTree,
} from 'store/augmented';
import {
  camperHooks,
  eventHooks,
  lodgingHooks,
  paymentHooks,
  registrationHooks,
  registrationTypeHooks,
} from 'store/entities';

/**
 * Assemble the report template variables for an event: the full event, the
 * augmented registrations + lookup, completed campers + lookup, the lodging
 * lookup, and the registration-type lookup. Returns undefined until every
 * dependency has loaded.
 */
export function useReportTemplateVars(eventId: string): ReportTemplateVars | undefined {
  const { data: event } = eventHooks.useById(eventId);
  const { data: registrations } = registrationHooks.useList({ completed: 1, event: eventId });
  const { data: campers } = camperHooks.useList({
    registration__completed: 1,
    registration__event: eventId,
  });
  const { data: payments } = paymentHooks.useList({
    registration__completed: 1,
    registration__event: eventId,
  });
  const { data: lodgings } = lodgingHooks.useList({ event: eventId });
  const { data: registrationTypes } = registrationTypeHooks.useList({ event: eventId });

  return useMemo(() => {
    if (!event || !registrations || !campers || !payments || !lodgings || !registrationTypes) {
      return undefined;
    }

    const registrationTypeLookup = buildRegistrationTypeLookup(registrationTypes);
    const registrationLookup = buildRegistrationLookup(
      registrations,
      campers,
      payments,
      registrationTypeLookup,
      eventId,
    );
    const camperLookup = buildCamperLookup(registrations, campers, eventId);
    const lodgingLookup = flattenLodgingTree(buildLodgingTree(lodgings, campers, eventId));

    return {
      event,
      registrations: Object.values(registrationLookup),
      registrationLookup,
      campers: Object.values(camperLookup),
      camperLookup,
      lodgingLookup,
      registrationTypeLookup,
    };
  }, [event, registrations, campers, payments, lodgings, registrationTypes, eventId]);
}
