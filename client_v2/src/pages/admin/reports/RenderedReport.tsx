/**
 * Render a report's output (SPEC §8.7). Handlebars (`hbs`) renders client-side
 * through the templating engine; csv/md/txt are rendered server-side (Jinja2)
 * and returned as a string, which we present per format:
 *   - csv → parsed into a bordered table (with a download).
 *   - md  → the markdown pipeline → sanitized HTML (with a download).
 *   - txt → preformatted text (with a download).
 * Render errors from the server are surfaced with their raw traceback.
 */

import { Alert, Button, Code, Group, Stack } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import type { ApiReport, ReportTemplateVars } from 'api-types';
import { InlineLoading } from 'components/Loading';
import { markdownToHtml, Template } from 'components/templating';
import { useRenderedReport } from 'store/reportRender';
import { downloadTextFile } from 'utils/download';

import { CsvTable } from './CsvTable';

const MIME: Record<string, string> = {
  csv: 'text/csv',
  md: 'text/markdown',
  txt: 'text/plain',
};

interface RenderedReportProps {
  report: ApiReport;
  templateVars: ReportTemplateVars | undefined;
}

function ServerRenderedReport({ report, templateVars }: RenderedReportProps) {
  const { data, isLoading } = useRenderedReport(report, templateVars);

  if (isLoading || !data) return <InlineLoading message="Rendering report…" />;

  if (data.error) {
    return (
      <Stack gap="xs">
        <Alert color="red" variant="light" title="Render error" />
        <Code block>{data.error}</Code>
      </Stack>
    );
  }

  const output = data.report;

  return (
    <Stack>
      <Group>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={() => downloadTextFile(output, MIME[report.output], `${report.title}.${report.output}`)}
        >
          Download {report.output.toUpperCase()}
        </Button>
      </Group>
      {report.output === 'csv' && <CsvTable csv={output} />}
      {report.output === 'md' && (
        // Safe: markdownToHtml sanitizes via rehype-sanitize (§11).
        <div className="md-template" dangerouslySetInnerHTML={{ __html: markdownToHtml(output) }} />
      )}
      {report.output === 'txt' && <Code block>{output}</Code>}
    </Stack>
  );
}

export function RenderedReport({ report, templateVars }: RenderedReportProps) {
  if (report.output === 'hbs') {
    return <Template markdown={report.template} templateVars={templateVars} />;
  }
  return <ServerRenderedReport report={report} templateVars={templateVars} />;
}
