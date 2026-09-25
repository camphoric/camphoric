/**
 * Render a report's output (SPEC §8.7). Handlebars (`hbs`) renders client-side
 * through the templating engine; the Jinja formats render on the server and
 * come back as a string, which is presented per format:
 *   - csv  → parsed into a bordered table (with a download).
 *   - md   → the markdown pipeline → sanitized HTML (with a download).
 *   - html → a sandboxed frame (with a download).
 *   - txt  → preformatted text (with a download).
 *
 * Reports with Camphoric variables render from the server's data and show
 * their problems with template line numbers. Legacy reports (and Handlebars)
 * first assemble the browser's variable bundle.
 */

import { Alert, Button, Code, Group, Stack } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import type { ApiRenderedReport, ApiReport } from 'api-types';
import { CsvTable } from 'components/CsvTable';
import { HtmlFrame } from 'components/HtmlFrame';
import { InlineLoading } from 'components/Loading';
import { TemplateDiagnostics } from 'components/TemplateEditor';
import { markdownToHtml, Template } from 'components/templating';
import { useReportTemplateVars } from 'hooks/useReportData';
import { useRenderedReport, useServerRenderedReport } from 'store/reportRender';
import { downloadTextFile } from 'utils/download';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  md: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
};

interface RenderedReportProps {
  report: ApiReport;
  eventId: string;
}

function ReportOutput({ report, data }: { report: ApiReport; data: ApiRenderedReport }) {
  const diagnostics = data.diagnostics ?? [];

  if (data.error) {
    return (
      <Stack gap="xs">
        <Alert color="red" variant="light" title="Render error">
          {diagnostics.length ? 'The template has problems:' : null}
        </Alert>
        {diagnostics.length ? (
          <TemplateDiagnostics diagnostics={diagnostics} />
        ) : (
          <Code block>{data.error}</Code>
        )}
      </Stack>
    );
  }

  const output = data.report;

  return (
    <Stack>
      <TemplateDiagnostics diagnostics={diagnostics} />
      <Group>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={() =>
            downloadTextFile(output, MIME[report.output], `${report.title}.${report.output}`)
          }
        >
          Download {report.output.toUpperCase()}
        </Button>
      </Group>
      {report.output === 'csv' && <CsvTable csv={output} />}
      {report.output === 'md' && (
        // Safe: markdownToHtml sanitizes via rehype-sanitize (§11).
        <div className="md-template" dangerouslySetInnerHTML={{ __html: markdownToHtml(output) }} />
      )}
      {report.output === 'html' && <HtmlFrame title={report.title} html={output} minHeight={400} />}
      {report.output === 'txt' && <Code block>{output}</Code>}
    </Stack>
  );
}

function ServerReport({ report }: { report: ApiReport }) {
  const { data, isLoading } = useServerRenderedReport(report);
  if (isLoading || !data) return <InlineLoading message="Rendering report…" />;
  return <ReportOutput report={report} data={data} />;
}

function LegacyReport({ report, eventId }: RenderedReportProps) {
  const templateVars = useReportTemplateVars(eventId);
  const { data, isLoading } = useRenderedReport(report, templateVars);
  if (isLoading || !data) return <InlineLoading message="Rendering report…" />;
  return <ReportOutput report={report} data={data} />;
}

function HandlebarsReport({ report, eventId }: RenderedReportProps) {
  const templateVars = useReportTemplateVars(eventId);
  return <Template markdown={report.template} templateVars={templateVars} />;
}

export function RenderedReport({ report, eventId }: RenderedReportProps) {
  if (report.output === 'hbs') return <HandlebarsReport report={report} eventId={eventId} />;
  if (report.variables_source === 'server') return <ServerReport report={report} />;
  return <LegacyReport report={report} eventId={eventId} />;
}
