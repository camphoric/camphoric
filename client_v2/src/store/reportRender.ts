/**
 * Server-side report rendering (SPEC §8.7). POSTs the template-variable bundle
 * to /api/reports/{id}/render; the server renders the Jinja2 template for the
 * csv/md/txt formats and returns `{ report, error }`. Handlebars (`hbs`) reports
 * render client-side and don't use this.
 *
 * The render is keyed on the report id and its `updated_at`, so saving an edit
 * (which bumps the timestamp) re-renders.
 */

import { useQuery } from '@tanstack/react-query';
import type { ApiRenderedReport, ApiReport, ReportTemplateVars } from 'api-types';
import { apiFetch } from 'utils/fetch';

export function useRenderedReport(
  report: ApiReport,
  templateVars: ReportTemplateVars | undefined,
) {
  return useQuery({
    // The render output is a function of the report definition and the variable
    // bundle; key on both so a data change (or an edit) re-renders.
    queryKey: ['renderedReport', report.id, report.updated_at, templateVars],
    queryFn: () =>
      apiFetch<ApiRenderedReport>(`/api/reports/${report.id}/render`, {
        method: 'POST',
        body: templateVars,
      }),
    enabled: !!templateVars,
    staleTime: 30_000,
  });
}
