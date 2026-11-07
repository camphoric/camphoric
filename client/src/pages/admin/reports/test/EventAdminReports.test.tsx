import userEvent from '@testing-library/user-event';
import type { ApiReport } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventAdminReports } from '../EventAdminReports';

const { reports, search, editForm } = vi.hoisted(() => ({
  reports: { list: [] as ApiReport[] },
  search: { reportId: undefined as string | undefined },
  editForm: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1', eventId: '7' }),
  useSearch: () => search,
  useNavigate: () => vi.fn(),
}));
vi.mock('store/entities', () => ({
  reportHooks: {
    useList: () => ({ data: reports.list }),
    useDelete: () => ({ mutate: vi.fn() }),
  },
}));
vi.mock('hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({ confirmDiscard: (go: () => void) => go(), release: vi.fn() }),
}));
vi.mock('components/EditLease', () => ({ BeingEdited: () => null, RecordDeleted: () => null }));
vi.mock('../RenderedReport', () => ({ RenderedReport: () => <div>rendered</div> }));
vi.mock('../ReportEditForm', () => ({
  ReportEditForm: (props: { categories: string[] }) => {
    editForm(props);
    return <div>report form</div>;
  },
}));

const report = (id: number, title: string, category = '', description = ''): ApiReport =>
  ({ id, event: 7, title, category, description, version: 1 }) as ApiReport;

function setup() {
  renderWithProviders(
    <PermissionsProvider userRole="admin">
      <EventAdminReports />
    </PermissionsProvider>,
  );
}

const titlesIn = (group: string) =>
  within(screen.getByRole('group', { name: group }))
    .getAllByRole('button')
    .map((button) => button.textContent);

beforeEach(() => {
  search.reportId = undefined;
  editForm.mockClear();
});

describe('EventAdminReports', () => {
  it('lists the reports under their categories, by title, with their descriptions', () => {
    reports.list = [
      report(1, 'rooms', 'Rooming'),
      report(2, 'Summary'),
      report(3, 'Payments', 'Finance', 'For the treasurer'),
      report(4, 'balances', 'finance'),
    ];
    setup();

    const groups = screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual(['finance', 'Rooming', 'Uncategorised']);
    expect(titlesIn('finance')).toEqual(['balances', 'PaymentsFor the treasurer']);
    expect(titlesIn('Rooming')).toEqual(['rooms']);
    expect(titlesIn('Uncategorised')).toEqual(['Summary']);
    expect(screen.getByText('Uncategorised')).toBeInTheDocument();
  });

  it('shows no category headings when no report has a category', () => {
    reports.list = [report(1, 'b'), report(2, 'A')];
    setup();

    expect(screen.queryByText('Uncategorised')).not.toBeInTheDocument();
    expect(titlesIn('Uncategorised')).toEqual(['A', 'b']);
  });

  it("shows the selected report's category and description, and offers the other reports' categories to its form", async () => {
    const user = userEvent.setup();
    reports.list = [
      report(3, 'Payments', 'Finance', 'For the treasurer'),
      report(5, 'Rooms', 'Rooming'),
    ];
    search.reportId = '3';
    setup();

    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.getByText('Finance — For the treasurer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(editForm).toHaveBeenCalledWith(
      // Not its own, so a change of capitals isn't snapped back to it
      expect.objectContaining({ categories: ['Rooming'] }),
    );
  });
});
