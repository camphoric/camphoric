/** Delete previews for the ConfirmDelete tests and stories, one per kind of answer. */

import type { ApiDeletePreview } from 'api-types';

const empty: ApiDeletePreview = {
  can_delete: true,
  blocked_by: [],
  deletes: [],
  changes: [],
  restorable: false,
};

/** A report: nothing else is affected. */
export const NOTHING_ELSE = empty;

/** A lodging with sub-lodgings, whose campers are unassigned. */
export const LODGING: ApiDeletePreview = {
  ...empty,
  deletes: [{ type: 'lodging', name: 'lodgings', count: 2, items: ['Cabin A', 'Cabin B'] }],
  changes: [
    {
      type: 'camper',
      name: 'campers',
      count: 23,
      items: Array.from({ length: 20 }, (_, n) => `Camper ${n + 1}`),
      description: 'will be unassigned from their lodging',
    },
  ],
};

/** A registration: soft-deleted, with what goes with it. */
export const REGISTRATION: ApiDeletePreview = {
  ...empty,
  restorable: true,
  deletes: [
    { type: 'camper', name: 'campers', count: 2, items: ['Pat Alpha', 'Sam Alpha'] },
    { type: 'payment', name: 'payment', count: 1, items: ['Check payment $100.00'] },
  ],
};

/** A group email template that's been sent: the sent emails stay in the history. */
export const SENT_TEMPLATE: ApiDeletePreview = {
  ...empty,
  changes: [
    {
      type: 'emailmessage',
      name: 'email messages',
      count: 140,
      items: [],
      description: 'stay in the email history',
    },
  ],
};

/** A charge type campers still have. */
export const BLOCKED: ApiDeletePreview = {
  ...empty,
  can_delete: false,
  blocked_by: [{ detail: 'Campers still have this charge.', count: 1, items: ['Linens $25.00'] }],
};
