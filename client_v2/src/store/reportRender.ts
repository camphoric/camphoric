/**
 * Server-side report rendering (SPEC §8.7). The server renders Jinja reports
 * (csv/md/txt/html) and returns `{ report, error, diagnostics? }`:
 *
 * - `server`-source reports render from the server's own variables; the
 *   request body is empty.
 * - `client`-source (legacy) reports POST the template-variable bundle the
 *   browser builds.
 *
 * Handlebars (`hbs`) reports render client-side and don't use this. The render
 * is keyed on the report id and its `updated_at`, so saving an edit (which
 * bumps the timestamp) re-renders.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiRenderedReport, ApiReport, ReportTemplateVars } from 'api-types';
import { apiFetch } from 'utils/fetch';

function renderReport(reportId: number, body: unknown) {
  return apiFetch<ApiRenderedReport>(`/api/reports/${reportId}/render`, {
    method: 'POST',
    body,
  });
}

/** A report that uses the server's variables. */
export function useServerRenderedReport(report: ApiReport) {
  return useQuery({
    queryKey: ['renderedReport', report.id, report.updated_at, 'server'],
    queryFn: () => renderReport(report.id, {}),
    staleTime: 30_000,
  });
}

/** A legacy report: renders once the browser's variable bundle is ready. */
export function useRenderedReport(report: ApiReport, templateVars: ReportTemplateVars | undefined) {
  return useQuery({
    // The render output is a function of the report definition and the variable
    // bundle; key on both so a data change (or an edit) re-renders.
    queryKey: ['renderedReport', report.id, report.updated_at, templateVars],
    queryFn: () => renderReport(report.id, templateVars),
    enabled: !!templateVars,
    staleTime: 30_000,
  });
}
