/**
 * A stand-in for `hooks/useEditLease` in tests that don't have a query client:
 * nobody else is editing, and this form holds no lease.
 *
 *   vi.mock('hooks/useEditLease', async () => (await import('test/leases')).mockEditLease);
 */

export const NO_LEASE = {
  other: null,
  viewOnly: false,
  overlapping: false,
  takeOver: () => Promise.resolve(),
};

export const mockEditLease = {
  useEditLease: () => NO_LEASE,
};
