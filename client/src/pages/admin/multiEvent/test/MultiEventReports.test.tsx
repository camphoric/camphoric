import userEvent from '@testing-library/user-event';
import type { ApiOrganizationReport, ApiRenderedReport } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MultiEventReports } from '../MultiEventReports';
import { OrganizationReportForm } from '../OrganizationReportForm';

const { reports, search, create, navigate, rendered, stats, renderFails } = vi.hoisted(() => ({
  stats: { loaded: true },
  renderFails: { value: false },
  reports: { list: [] as ApiOrganizationReport[] },
  search: { reportId: undefined as string | undefined, series: undefined as string | undefined },
  create: vi.fn(),
  navigate: vi.fn(),
  rendered: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1' }),
  useSearch: () => search,
  useNavigate: () => navigate,
}));
vi.mock('store/entities', () => ({
  organizationHooks: { useById: () => ({ data: { id: 1, name: 'Lark' } }) },
  organizationReportHooks: {
    useList: () => ({ data: reports.list }),
    useDelete: () => ({ mutate: vi.fn() }),
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  },
}));
vi.mock('store/multiEvent', () => ({
  useMultiEventStats: () => ({
    data: stats.loaded ? { series: ['Camp', 'Campout'], events: [], people: [] } : undefined,
    isError: false,
  }),
  useRenderedOrganizationReport: (report: ApiOrganizationReport, series?: string) => {
    rendered(report.id, series);
    if (renderFails.value) return { isError: true, error: new Error('Server error') };
    return { data: { report: 'Event,People\nCamp 2025,40', error: null } as ApiRenderedReport };
  },
}));
vi.mock('hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({ confirmDiscard: (go: () => void) => go(), release: vi.fn() }),
}));
// Monaco doesn't load in jsdom; a textarea stands in for the editor.
vi.mock('../MultiEventTemplateEditor', () => ({
  MultiEventTemplateEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Template"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  ),
}));

const report = (id: number, title: string, category = ''): ApiOrganizationReport =>
  ({
    id,
    organization: 1,
    title,
    category,
    description: '',
    output: 'csv',
    template: '',
    version: 1,
  }) as ApiOrganizationReport;

function setup(userRole: 'admin' | 'reporter' = 'admin') {
  renderWithProviders(
    <PermissionsProvider userRole={userRole}>
      <MultiEventReports />
    </PermissionsProvider>,
  );
}

beforeEach(() => {
  search.reportId = undefined;
  search.series = undefined;
  reports.list = [];
  create.mockClear();
  navigate.mockClear();
  rendered.mockClear();
  stats.loaded = true;
  renderFails.value = false;
});

describe('MultiEventReports', () => {
  it('lists the organization’s reports and renders the chosen one for a series', async () => {
    reports.list = [report(1, 'Retention', 'People'), report(2, 'Totals')];
    search.reportId = '1';
    search.series = 'Campout';
    setup();
    expect(screen.getByRole('button', { name: 'Totals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Retention' })).toBeInTheDocument();
    expect(rendered).toHaveBeenCalledWith(1, 'Campout');
    expect(screen.getByRole('cell', { name: 'Camp 2025' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Series' }));
    await userEvent.setup().click(screen.getByRole('option', { name: 'All included events' }));
    expect(navigate).toHaveBeenCalled();
  });

  it('ignores a series that isn’t one of the organization’s', () => {
    reports.list = [report(1, 'Retention')];
    search.reportId = '1';
    search.series = 'Gone';
    setup();
    expect(rendered).toHaveBeenCalledWith(1, undefined);
  });

  it('waits for the series list before rendering for a series in the URL', () => {
    reports.list = [report(1, 'Retention')];
    search.reportId = '1';
    search.series = 'Camp';
    stats.loaded = false;
    setup();
    expect(rendered).not.toHaveBeenCalled();
  });

  it('says so when a report can’t be rendered', () => {
    reports.list = [report(1, 'Retention')];
    search.reportId = '1';
    renderFails.value = true;
    setup();
    expect(screen.getByText('Couldn’t render this report')).toBeInTheDocument();
  });

  it('lets a Reporter read reports but not write them', () => {
    reports.list = [report(1, 'Retention')];
    search.reportId = '1';
    setup('reporter');
    expect(screen.queryByRole('button', { name: 'New report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

describe('OrganizationReportForm', () => {
  it('creates a report for the organization once it has a title', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PermissionsProvider userRole="registrar">
        <OrganizationReportForm
          organizationId="1"
          categories={['People']}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />
      </PermissionsProvider>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Who came back');
    await user.type(screen.getByRole('combobox', { name: 'Category' }), 'people');
    await user.type(screen.getByRole('textbox', { name: 'Template' }), '{{{{ people | length }}');
    await user.click(save);
    expect(create).toHaveBeenCalledWith(
      {
        organization: '1',
        title: 'Who came back',
        category: 'People',
        description: '',
        output: 'csv',
        template: '{{ people | length }}',
      },
      expect.anything(),
    );
  });
});
