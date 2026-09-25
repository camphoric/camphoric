/**
 * The live preview beside the template editor (SPEC §9.6): the template
 * rendered against real data, in its output format, with the problems found
 * (click one to jump to its line) and a notice when the output was cut off.
 */

import { Alert, Code, Group, Loader, Stack, Text } from '@mantine/core';
import type { TemplateDiagnostic, TemplatePreviewOutput, TemplatePreviewResponse } from 'api-types';
import { CsvTable } from 'components/CsvTable';
import { HtmlFrame } from 'components/HtmlFrame';
import { markdownToHtml } from 'components/templating';

import { TemplateDiagnostics } from './TemplateDiagnostics';

interface TemplatePreviewPanelProps {
  output: TemplatePreviewOutput;
  preview?: TemplatePreviewResponse;
  /** A render is in flight (the previous result stays on screen). */
  rendering?: boolean;
  /** The preview request itself failed. */
  error?: string | null;
  onJump?: (diagnostic: TemplateDiagnostic) => void;
}

function PreviewOutput({
  output,
  preview,
}: {
  output: TemplatePreviewOutput;
  preview: TemplatePreviewResponse;
}) {
  const text = preview.output;
  if (!text.trim() && output !== 'email') {
    return (
      <Text size="sm" c="dimmed">
        The template produced no output.
      </Text>
    );
  }
  switch (output) {
    case 'csv':
      return <CsvTable csv={text} />;
    case 'md':
      // Safe: markdownToHtml sanitizes via rehype-sanitize (§11).
      return (
        <div className="md-template" dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />
      );
    case 'html':
      return <HtmlFrame title="Preview" html={text} />;
    case 'email':
      return (
        <Stack gap="xs">
          <Text size="sm">
            <Text span fw={600} size="sm">
              Subject:{' '}
            </Text>
            {preview.subject}
          </Text>
          <HtmlFrame title="Email preview" html={preview.html ?? ''} />
        </Stack>
      );
    default:
      return <Code block>{text}</Code>;
  }
}

export function TemplatePreviewPanel({
  output,
  preview,
  rendering,
  error,
  onJump,
}: TemplatePreviewPanelProps) {
  return (
    <Stack gap="sm" aria-label="Template preview" role="region">
      <Group gap="xs" justify="space-between">
        <Text size="sm" c="dimmed">
          {preview?.sample ? `Preview for ${preview.sample.label}` : 'Preview'}
          {preview && ` · ${preview.duration_ms} ms`}
        </Text>
        {rendering && <Loader size="xs" aria-label="Rendering preview" />}
      </Group>
      {error && (
        <Alert color="red" variant="light" title="Preview failed">
          {error}
        </Alert>
      )}
      {!preview && !error && (
        <Text size="sm" c="dimmed">
          Rendering…
        </Text>
      )}
      {preview && (
        <>
          <TemplateDiagnostics diagnostics={preview.diagnostics} onJump={onJump} />
          {preview.truncated && (
            <Alert color="yellow" variant="light">
              The output is too long to preview in full; only the beginning is shown.
            </Alert>
          )}
          <PreviewOutput output={output} preview={preview} />
        </>
      )}
    </Stack>
  );
}
