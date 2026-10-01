import type { ApiCamper, AugmentedLodging } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { EventAdminLodging } from '../EventAdminLodging';

const search = vi.hoisted((): { current: Record<string, string> } => ({ current: {} }));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1', eventId: '7' }),
  useSearch: () => search.current,
  useNavigate: () => vi.fn(),
}));

const CAMPER = { id: 5, registration: 9 } as unknown as ApiCamper;
const CABIN = { id: 10, name: 'Cabin A', children: [] } as unknown as AugmentedLodging;

vi.mock('store/entities', () => ({
  eventHooks: { useById: () => ({ data: { start: '2026-10-16', end: '2026-10-18' } }) },
  registrationHooks: { useList: () => ({ data: [] }) },
  lodgingHooks: { useDelete: () => ({ mutate: vi.fn() }) },
}));
vi.mock('hooks/useLodgingData', () => ({
  useLodgingData: () => ({
    tree: CABIN,
    lodgingLookup: { '10': CABIN },
    leaves: [CABIN],
    campers: [CAMPER],
    unassigned: [],
  }),
}));
vi.mock('hooks/useAdminData', () => ({ useRegistrationTypeLookup: () => ({}) }));
vi.mock('hooks/useLodgingAssignment', () => ({
  useLodgingAssignment: () => ({ mutate: vi.fn() }),
}));
vi.mock('../camperLodgingDetails', () => ({
  camperLodgingDetails: () => ({ camperId: 5, name: 'Bob Ross' }),
}));
vi.mock('../CamperLodgingInfo', () => ({ CamperLodgingInfo: () => <div>Camper details</div> }));
vi.mock('../LodgingDetailsPanel', () => ({
  LodgingDetailsPanel: ({ onEdit }: { onEdit?: unknown }) => (
    <div>
      Lodging details
      {onEdit ? <button type="button">Edit</button> : null}
    </div>
  ),
}));
vi.mock('../LodgingTree', () => ({ LodgingTree: () => <div>The tree</div> }));
vi.mock('../LodgingNodeForm', () => ({ LodgingNodeForm: () => null }));
vi.mock('../LodgingTimeline', () => ({ LodgingTimeline: () => <div>The timeline</div> }));

function setup(params: Record<string, string>) {
  search.current = params;
  renderWithProviders(<EventAdminLodging />);
}

describe('EventAdminLodging', () => {
  it('names the views Layout and Assignments', () => {
    setup({});
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('offers Edit in the lodging details on the hierarchy', () => {
    setup({ lodgingId: '10' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('offers Edit in the lodging details on the timeline too', () => {
    setup({ lodgingView: 'timeline', timelineLodgingId: '10' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows the hierarchy’s selected camper and lodging on the hierarchy', () => {
    setup({ camperId: '5', lodgingId: '10' });
    expect(screen.getByText('Camper details')).toBeInTheDocument();
    expect(screen.getByText('Lodging details')).toBeInTheDocument();
  });

  it('doesn’t carry the hierarchy’s selections to the timeline', () => {
    setup({ lodgingView: 'timeline', camperId: '5', lodgingId: '10' });
    expect(screen.getByText('The timeline')).toBeInTheDocument();
    expect(screen.queryByText('Camper details')).toBeNull();
    expect(screen.queryByText('Lodging details')).toBeNull();
  });

  it('shows the timeline’s selected camper and lodging on the timeline', () => {
    setup({ lodgingView: 'timeline', timelineCamperId: '5', timelineLodgingId: '10' });
    expect(screen.getByText('Camper details')).toBeInTheDocument();
    expect(screen.getByText('Lodging details')).toBeInTheDocument();
  });

  it('doesn’t carry the timeline’s selections to the hierarchy', () => {
    setup({ timelineCamperId: '5', timelineLodgingId: '10' });
    expect(screen.getByText('The tree')).toBeInTheDocument();
    expect(screen.queryByText('Camper details')).toBeNull();
    expect(screen.queryByText('Lodging details')).toBeNull();
  });
});
