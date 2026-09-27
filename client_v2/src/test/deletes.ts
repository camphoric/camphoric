/**
 * A stand-in for `store/deletes` in tests that don't have a query client: the
 * delete confirmation gets a preview at once that lets the delete go ahead.
 *
 *   vi.mock('store/deletes', async () => (await import('test/deletes')).mockDeletes);
 */

import type { ApiDeletePreview } from 'api-types';

export const ALLOWED_DELETE: ApiDeletePreview = {
  can_delete: true,
  blocked_by: [],
  deletes: [],
  changes: [],
  restorable: false,
};

export const mockDeletes = {
  useDeletePreview: () => ({ data: ALLOWED_DELETE, error: null }),
};
