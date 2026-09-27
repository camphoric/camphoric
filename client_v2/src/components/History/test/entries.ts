/** Audit entries for the History tests and stories: one registration's life so far. */

import type { ApiHistoryEntry } from 'api-types';

const reggie = { id: 4, username: 'reggie', name: 'Reggie Registrar' };

let nextId = 100;
const entry = (fields: Partial<ApiHistoryEntry>): ApiHistoryEntry => ({
  id: nextId++,
  timestamp: '2026-09-26T18:00:00Z',
  request_id: null,
  actor: reggie,
  action: 'update',
  object: { type: 'registration', id: 5, label: 'Registration #5 (Lark Camp)' },
  changes: {},
  ...fields,
});

/** Newest first, as the server sends them. */
export const ENTRIES: ApiHistoryEntry[] = [
  entry({
    timestamp: '2026-09-26T19:30:00Z',
    action: 'restore',
    object: { type: 'camper', id: 9, label: 'Sam Alpha' },
    changes: { deleted_at: ['2026-09-26 19:00:00', null] },
  }),
  entry({
    timestamp: '2026-09-26T19:00:00Z',
    action: 'delete',
    object: { type: 'camper', id: 9, label: 'Sam Alpha' },
    changes: { deleted_at: [null, '2026-09-26 19:00:00'] },
  }),
  // One save: the edit, and the price it recalculated.
  entry({
    timestamp: '2026-09-26T18:30:00Z',
    request_id: 'abc',
    changes: {
      attributes: [
        { campership_donation: 25, address: { street: '1 Main St', city: 'Berkeley' } },
        { campership_donation: 50, address: { street: '1 Main St', city: 'Oakland' } },
      ],
      registrant_email: ['pat@example.com', 'pat.alpha@example.com'],
      registration_type: [null, '2'],
    },
  }),
  entry({
    timestamp: '2026-09-26T18:30:00Z',
    request_id: 'abc',
    changes: { server_pricing_results: [{ total: 825 }, { total: 850 }] },
  }),
  entry({
    timestamp: '2026-09-26T18:10:00Z',
    object: { type: 'payment', id: 3, label: 'Check payment $100.00' },
    changes: { amount: ['100.00', '120.00'], paid_on: [null, '2026-10-01'] },
  }),
  entry({
    timestamp: '2026-09-25T12:00:00Z',
    actor: null,
    action: 'create',
    changes: { registrant_email: [null, 'pat@example.com'] },
  }),
];

export const TITLES = {
  registration: {
    campership_donation: 'Campership donation',
    address: 'Main address',
    'address.city': 'City',
  },
};

export const LOOKUPS = { registration_type: { '2': 'Staff' } };
