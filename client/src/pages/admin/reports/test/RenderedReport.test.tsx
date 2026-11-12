import userEvent from '@testing-library/user-event';
import type { ApiRenderedReport, ApiReport } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderedReport } from '../RenderedReport';

const { server, legacy, templateVars, printHtml, downloadTextFile, eventById } = vi.hoisted(() => ({
  server: vi.fn(),
  legacy: vi.fn(),
  templateVars: vi.fn(),
  printHtml: vi.fn(),
  downloadTextFile: vi.fn(),
  eventById: vi.fn(),
}));

vi.mock('store/reportRender', () => ({
  useServerRenderedReport: server,
  useRenderedReport: legacy,
}));
vi.mock('hooks/useReportData', () => ({ useReportTemplateVars: templateVars }));
vi.mock('utils/print', () => ({ printHtml }));
vi.mock('utils/download', () => ({ downloadTextFile }));
vi.mock('store/entities', () => ({ eventHooks: { useById: eventById } }));

const report = (overrides: Partial<ApiReport>) =>
  ({
    id: 1,
    event: 7,
    title: 'Roster',
    category: '',
    description: '',
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
  printHtml.mockReset();
  downloadTextFile.mockReset();
  eventById.mockReset();
  eventById.mockReturnValue({ data: { id: 7, name: 'Lark Camp 2026' } });
});

describe('RenderedReport', () => {
  it('renders server reports without building the browser bundle', () => {
    server.mockReturnValue(rendered({ report: 'Name\nPat\n', error: null, diagnostics: [] }));
    renderWithProviders(<RenderedReport report={report({})} eventId="7" />);

    expect(screen.getByRole('cell', { name: 'Pat' })).toBeInTheDocument();
    expect(templateVars).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
  });

  it('puts the output in its own scrolling region, with the download outside it', () => {
    server.mockReturnValue(rendered({ report: 'Name\nPat\n', error: null, diagnostics: [] }));
    renderWithProviders(<RenderedReport report={report({})} eventId="7" />);

    const output = screen.getByRole('region', { name: 'Report output' });
    expect(output).toHaveStyle({ overflow: 'auto' });
    expect(within(output).getByRole('cell', { name: 'Pat' })).toBeInTheDocument();
    expect(within(output).queryByRole('button', { name: /Download/ })).toBeNull();
    expect(within(output).queryByRole('button', { name: /Print/ })).toBeNull();
  });

  it('prints the output by itself', async () => {
    server.mockReturnValue(rendered({ report: 'Name\nPat\n', error: null, diagnostics: [] }));
    renderWithProviders(<RenderedReport report={report({})} eventId="7" />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Print' }));

    expect(printHtml).toHaveBeenCalledOnce();
    const [html, title] = printHtml.mock.calls[0] as [string, string];
    expect(title).toBe('Roster');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<td>Pat</td>');
  });

  it('names the download for the event, the category and the title', async () => {
    server.mockReturnValue(rendered({ report: 'Name\nPat\n', error: null, diagnostics: [] }));
    renderWithProviders(
      <RenderedReport report={report({ category: 'Staff', title: 'Cabins 1/2' })} eventId="7" />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(eventById).toHaveBeenCalledWith('7');
    expect(downloadTextFile).toHaveBeenCalledWith(
      'Name\nPat\n',
      'text/csv',
      'Lark Camp 2026, Staff, Cabins 1-2.csv',
    );
  });

  it('leaves an uncategorised legacy report’s category out of the download’s name', async () => {
    templateVars.mockReturnValue({ campers: [] });
    legacy.mockReturnValue(rendered({ report: 'plain text', error: null }));
    renderWithProviders(
      <RenderedReport report={report({ variables_source: 'client', output: 'txt' })} eventId="7" />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download TXT' }));

    expect(downloadTextFile).toHaveBeenCalledWith(
      'plain text',
      'text/plain',
      'Lark Camp 2026, Roster.txt',
    );
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
