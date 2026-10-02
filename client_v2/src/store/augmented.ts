/**
 * Augmented view models derived from cached query data (SPEC §5). These are the
 * pure builders — given the raw per-event entity arrays, they produce the
 * registration/camper/lodging lookups and the report template-variable bundle.
 * The hooks that fetch and feed them live in `hooks/useReportData.ts`.
 *
 * Behavior mirrors the v1 client (`client/src/hooks/api.ts`) exactly, since the
 * Handlebars helpers and reports depend on these shapes (DR-27): registration
 * totals (owed/payments/balance, from the server's ledger — §9.7), camper
 * filtering to completed registrations, and the lodging tree with
 * counts/capacity/full paths.
 */

import type {
  ApiCamper,
  ApiLodging,
  ApiRegistration,
  ApiRegistrationType,
  AugmentedLodging,
  AugmentedRegistration,
  CamperLookup,
  LodgingLookup,
  RegistrationLookup,
  RegistrationTypeLookup,
} from 'api-types';

const sameId = (a: { toString(): string }, b: { toString(): string }) =>
  a.toString() === b.toString();

export function buildRegistrationTypeLookup(
  registrationTypes: ApiRegistrationType[],
): RegistrationTypeLookup {
  const lookup: RegistrationTypeLookup = {};
  registrationTypes.forEach((rt) => (lookup[rt.id.toString()] = rt));
  return lookup;
}

/**
 * Augment each (event-scoped) registration with its campers, registration type,
 * and money totals, keyed by id. The totals are the server's ledger (§9.7):
 * `total_owed` is the price plus its invoices' handling fees, `total_payments`
 * what's been paid less refunds, and `total_balance` the difference.
 */
export function buildRegistrationLookup(
  registrations: ApiRegistration[],
  campers: ApiCamper[],
  registrationTypeLookup: RegistrationTypeLookup,
  eventId: string,
): RegistrationLookup {
  const lookup: RegistrationLookup = {};

  registrations
    .filter((r) => sameId(r.event, eventId))
    .forEach((r) => {
      const augmented: AugmentedRegistration = {
        ...r,
        total_payments: r.total_paid,
        total_balance: r.balance,
        registrationType:
          r.registration_type == null ? undefined : registrationTypeLookup[r.registration_type],
        campers: campers.filter((c) => sameId(c.registration, r.id)),
      };

      lookup[r.id] = augmented;
    });

  return lookup;
}

/** Campers belonging to completed registrations for the event, keyed by id. */
export function buildCamperLookup(
  registrations: ApiRegistration[],
  campers: ApiCamper[],
  eventId: string,
): CamperLookup {
  const completedIds = new Set(
    registrations
      .filter((r) => sameId(r.event, eventId) && r.completed !== false)
      .map((r) => r.id.toString()),
  );

  const lookup: CamperLookup = {};
  campers
    .filter((c) => completedIds.has(c.registration.toString()))
    .forEach((c) => (lookup[c.id] = c));
  return lookup;
}

/**
 * Build the lodging tree from the flat list (rooted at the parent-less node),
 * augmenting each node with its assigned campers, recursive occupancy `count`,
 * effective `capacity` (explicit, else summed from children), and full path.
 * Returns undefined when there's no root lodging for the event.
 */
export function buildLodgingTree(
  lodgings: ApiLodging[],
  campers: ApiCamper[],
  eventId: string,
): AugmentedLodging | undefined {
  const forEvent = lodgings.filter((l) => sameId(l.event, eventId));
  const root = forEvent.find((l) => !l.parent);
  if (!root) return undefined;

  const fullPathOf = (
    lodging: ApiLodging | undefined,
    parts: string[] = [],
  ): { fullPath: string; pathParts: string[] } => {
    if (!lodging || lodging.parent == null) {
      const pathParts = parts.reverse();
      return { fullPath: pathParts.join('→'), pathParts };
    }
    const parentId = lodging.parent;
    return fullPathOf(
      forEvent.find((l) => sameId(l.id, parentId)),
      [...parts, lodging.name],
    );
  };

  const createNode = (lodging: ApiLodging): AugmentedLodging => {
    const children = forEvent.filter((l) => l.parent === lodging.id).map(createNode);
    const ownCampers = campers.filter((c) => c.lodging === lodging.id);
    const count = children.reduce((acc, c) => c.count + acc, ownCampers.length);
    const maxCapacity = children.reduce((acc, c) => c.capacity + acc, lodging.capacity);

    return {
      ...lodging,
      isLeaf: children.length === 0,
      children,
      campers: ownCampers,
      count,
      capacity: lodging.capacity || maxCapacity,
      maxCapacity,
      ...fullPathOf(lodging),
    };
  };

  return createNode(root);
}

/**
 * Every node of a lodging tree in tree order (each node before its children).
 * The id-keyed lookup can't give this order: an object's integer-like keys
 * iterate in ascending id order, so a unit added later would sort last.
 */
export function listLodgingTree(tree: AugmentedLodging | undefined): AugmentedLodging[] {
  const list = (node: AugmentedLodging): AugmentedLodging[] => [
    node,
    ...node.children.flatMap(list),
  ];
  return tree ? list(tree) : [];
}

/** Flatten a lodging tree into an id→node lookup (used by report templates). */
export function flattenLodgingTree(tree: AugmentedLodging | undefined): LodgingLookup {
  const lookup: LodgingLookup = {};
  const visit = (node: AugmentedLodging) => {
    lookup[node.id] = node;
    node.children.forEach(visit);
  };
  if (tree) visit(tree);
  return lookup;
}
