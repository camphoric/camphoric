/**
 * Says when the open event's live updates aren't coming in (SPEC §9.8; §15,
 * DR-112): reconnecting after a drop, or off (the server isn't streaming).
 * Nothing shows while they're live or still starting.
 */

import { Badge } from '@mantine/core';
import type { LiveFeedState } from 'store/liveFeed';

const SHOWN: Partial<Record<LiveFeedState, { label: string; title: string; color: string }>> = {
  reconnecting: {
    label: 'Reconnecting…',
    title: 'Live updates dropped; trying again. What others change shows once they’re back.',
    color: 'yellow',
  },
  off: {
    label: 'Live updates off',
    title: 'What others change shows when you come back to this tab or reload.',
    color: 'gray',
  },
};

export function LiveUpdatesStatus({ state }: { state: LiveFeedState }) {
  const shown = SHOWN[state];
  if (!shown) return null;
  return (
    <Badge variant="light" color={shown.color} title={shown.title} style={{ flexShrink: 0 }}>
      {shown.label}
    </Badge>
  );
}
