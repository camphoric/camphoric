/**
 * The state of the open event's live change feed (SPEC §9.8; §15, DR-112), for
 * what would otherwise look again on a timer (edit leases) to know it needn't.
 */

import { createContext, useContext } from 'react';

/**
 * `connecting` before it first opens, `live` while it's open, `reconnecting`
 * after it dropped, and `off` when the server won't stream (a WSGI dev server,
 * a signed-out session) or there's no event.
 */
export type LiveFeedState = 'connecting' | 'live' | 'reconnecting' | 'off';

export const LiveFeedContext = createContext<LiveFeedState>('off');

export function useLiveFeedState(): LiveFeedState {
  return useContext(LiveFeedContext);
}
