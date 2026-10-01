import type { ApiCamper } from 'api-types';
import { act, renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { LodgingTimeline } from '../LodgingTimeline';
import { DAYS, FILTER_NODES, leavesWith } from './lodgingFixtures';

/** jsdom lays nothing out, so each day is the timeline's narrowest. */
const DAY_WIDTH = 44;
const barWidth = (days: number) => `${days * DAY_WIDTH - 4}px`;

const STAY = [DAYS[0], DAYS[1], DAYS[2]];
const bob = (stay: string[]) =>
  ({
    id: 1,
    attributes: { first_name: 'Bob', last_name: 'Ross' },
    lodging: 10,
    stay,
  }) as unknown as ApiCamper;

function Timeline({ stay, onAssign }: { stay: string[]; onAssign: () => void }) {
  return (
    <LodgingTimeline
      days={DAYS}
      leaves={leavesWith([bob(stay)])}
      filterNodes={FILTER_NODES}
      shownLodgingIds={[]}
      onShownLodgingChange={vi.fn()}
      unassigned={[]}
      defaultStayLength={2}
      onAssign={onAssign}
      onUnassign={vi.fn()}
    />
  );
}

/** Drags the bar's right edge by a number of days. */
function resize(bar: HTMLElement, byDays: number) {
  const handle = bar.lastElementChild as HTMLElement;
  act(() => {
    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: byDays * DAY_WIDTH }));
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: byDays * DAY_WIDTH }));
  });
}

describe('LodgingTimeline resizing', () => {
  it('keeps a resized bar’s length until the camper’s stay catches up', () => {
    const onAssign = vi.fn();
    const { rerender } = renderWithProviders(<Timeline stay={STAY} onAssign={onAssign} />);
    const bar = screen.getByRole('button', { name: 'Bob Ross' });
    expect(bar.style.width).toBe(barWidth(3));

    resize(bar, -1);
    expect(onAssign).toHaveBeenCalledWith(1, 10, [DAYS[0], DAYS[1]]);
    // The new stay hasn't reached the timeline yet; the bar mustn't flash back.
    expect(bar.style.width).toBe(barWidth(2));

    rerender(<Timeline stay={[DAYS[0], DAYS[1]]} onAssign={onAssign} />);
    expect(bar.style.width).toBe(barWidth(2));
  });

  it('shows the old stay when a save is rolled back', () => {
    const onAssign = vi.fn();
    const { rerender } = renderWithProviders(<Timeline stay={STAY} onAssign={onAssign} />);
    const bar = screen.getByRole('button', { name: 'Bob Ross' });
    resize(bar, -1);
    rerender(<Timeline stay={[DAYS[0], DAYS[1]]} onAssign={onAssign} />);
    rerender(<Timeline stay={[...STAY]} onAssign={onAssign} />);
    expect(bar.style.width).toBe(barWidth(3));
  });
});
