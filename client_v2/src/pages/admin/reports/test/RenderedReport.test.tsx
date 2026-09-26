import type { ApiRenderedReport, ApiReport } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderedReport } from '../RenderedReport';

const { server, legacy, templateVars } = vi.hoisted(() => ({
  server: vi.fn(),
  legacy: vi.fn(),
  templateVars: vi.fn(),
}));

vi.mock('store/reportRender', () => ({
  useServerRenderedReport: server,
  useRenderedReport: legacy,
}));
vi.mock('hooks/useReportData', () => ({ useReportTemplateVars: templateVars }));

const report = (overrides: Partial<ApiReport>) =>
  ({
    id: 1,
    event: 7,
    title: 'Roster',
    output: 'csv',
    template: '',
    variables_schema: {},
    variables_source: 'server',
    ...overrides,
  }) as ApiReport;

const rendered = (data: ApiRenderedReport) => ({ data, isLoading: false });

beforeEach(() => {
  server.mockReset();
  legacy.mockReset();
  templateVars.mockReset();
});

describe('RenderedReport', () => {
  it('renders server reports without building the browser bundle', () => {
    server.mockReturnValue(rendered({ report: 'Name\nPat\n', error: null, diagnostics: [] }));
    renderWithProviders(<RenderedReport report={report({})} eventId="7" />);

    expect(screen.getByRole('cell', { name: 'Pat' })).toBeInTheDocument();
    expect(templateVars).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
  });

  it('shows a server report’s problems with their lines', () => {
    server.mockReturnValue(
      rendered({
        report: '',
        error: "camper has no field 'nope'",
        diagnostics: [
          {
            severity: 'error',
            kind: 'undefined',
            message: "camper has no field 'nope'",
            field: 'template',
            line: 2,
            column: 14,
          },
        ],
      }),
    );
    renderWithProviders(<RenderedReport report={report({})} eventId="7" />);

    expect(screen.getByText('Render error')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent(
      "Line 2, column 14: camper has no field 'nope'",
    );
  });

  it('builds the bundle for legacy reports', () => {
    templateVars.mockReturnValue({ campers: [] });
    legacy.mockReturnValue(rendered({ report: 'plain text', error: null }));
    renderWithProviders(
      <RenderedReport report={report({ variables_source: 'client', output: 'txt' })} eventId="7" />,
    );

    expect(templateVars).toHaveBeenCalledWith('7');
    expect(legacy).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { campers: [] });
    expect(screen.getByText('plain text')).toBeInTheDocument();
  });
});
