import userEvent from '@testing-library/user-event';
import type { ApiCamper, LodgingLookup } from 'api-types';
import { isUnassigned } from 'pages/admin/lodging/timelineUtils';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { CamperLodging } from '../CamperLodging';
import { camperLodgingSummary } from '../camperLodgingSummary';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18'];

// "Let registrar assign" is a leaf, as Lark's registration form offers it.
const lookup = {
  '4': {
    id: 4,
    isLeaf: true,
    pathParts: ['Let registrar assign'],
    notes: '',
    campers: [],
  },
} as unknown as LodgingLookup;

describe('CamperLodging', () => {
  it('places a camper in a leaf with no days once days are ticked', async () => {
    const user = userEvent.setup();
    const camper = { id: 1, lodging: 4, stay: null } as unknown as ApiCamper;
    expect(isUnassigned(camper, lookup, DAYS)).toBe(true);

    const onStayChange = vi.fn();
    renderWithProviders(
      <CamperLodging
        summary={camperLodgingSummary(camper, lookup)}
        days={DAYS}
        stay={[]}
        onStayChange={onStayChange}
        onSelectCamper={vi.fn()}
        onOpenLodging={vi.fn()}
      />,
    );
    // The unit they chose still shows, with no days ticked.
    expect(screen.getByText('Let registrar assign')).toBeInTheDocument();
    expect(screen.getByText('No days set')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Fri 10/16' }));
    expect(onStayChange).toHaveBeenCalledWith(['2026-10-16']);
    expect(isUnassigned({ ...camper, stay: ['2026-10-16'] }, lookup, DAYS)).toBe(false);
  });
});
