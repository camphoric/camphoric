/**
 * The Jinja template editor (SPEC §9.6, DR-36): Monaco with Jinja
 * highlighting, autocomplete and hover docs for the variables this kind of
 * template receives, problems underlined in the text, and a live preview
 * rendered by the server against the event's real data.
 *
 * `TemplateEditor` fetches the variable spec and the preview;
 * `TemplateEditorView` takes them as props (for stories and tests).
 */

import { SimpleGrid, Stack } from '@mantine/core';
import type { OnMount } from '@monaco-editor/react';
import type {
  TemplateContextName,
  TemplateDescription,
  TemplateDiagnostic,
  TemplatePreviewOutput,
  TemplatePreviewResponse,
} from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTemplateDescription, useTemplatePreview } from 'store/templates';
import { ApiError } from 'utils/fetch';

import { toMarkers } from './diagnostics';
import { LANGUAGE_ID } from './jinjaLanguage';
import {
  ensureJinjaSupport,
  type Monaco,
  registerModelContext,
  unregisterModelContext,
} from './languageServices';
import { TemplatePreviewPanel } from './TemplatePreviewPanel';

const MARKER_OWNER = 'camphoric-template';

const EDITOR_OPTIONS = {
  wordBasedSuggestions: 'off',
  quickSuggestions: { other: true, comments: false, strings: false },
  suggest: { showWords: false },
  wordWrap: 'on',
  // Let the suggestion and hover widgets overflow a card or modal.
  fixedOverflowWidgets: true,
} as const;

export interface TemplateEditorViewProps {
  value: string;
  onChange: (value: string) => void;
  context: TemplateContextName;
  output: TemplatePreviewOutput;
  /** The variable spec; autocomplete and hover wait for it. */
  description?: TemplateDescription;
  preview?: TemplatePreviewResponse;
  rendering?: boolean;
  previewError?: string | null;
  showPreview?: boolean;
  height?: number | string;
}

interface Mounted {
  editor: MonacoEditor.IStandaloneCodeEditor;
  monaco: Monaco;
}

export function TemplateEditorView({
  value,
  onChange,
  context,
  output,
  description,
  preview,
  rendering,
  previewError,
  showPreview = true,
  height = 360,
}: TemplateEditorViewProps) {
  const id = useId().replace(/\W/g, '');
  const path = `camphoric-template/${context}/${id}.jinja`;
  const [mounted, setMounted] = useState<Mounted | null>(null);

  const onMount = useCallback<OnMount>(
    (editor, monaco) => setMounted({ editor, monaco: monaco as unknown as Monaco }),
    [],
  );

  // Tell the shared providers which variables this editor's model has.
  useEffect(() => {
    const uri = mounted?.editor.getModel()?.uri.toString();
    if (!uri || !description) return undefined;
    registerModelContext(uri, { description, context });
    return () => unregisterModelContext(uri);
  }, [mounted, description, context]);

  // Underline the problems the last preview found.
  useEffect(() => {
    const model = mounted?.editor.getModel();
    if (!mounted || !model) return;
    mounted.monaco.editor.setModelMarkers(
      model,
      MARKER_OWNER,
      preview ? toMarkers(preview.diagnostics, model) : [],
    );
  }, [mounted, preview]);

  const jump = useCallback(
    (d: TemplateDiagnostic) => {
      if (!mounted || !d.line) return;
      mounted.editor.revealLineInCenter(d.line);
      mounted.editor.setPosition({ lineNumber: d.line, column: d.column ?? 1 });
      mounted.editor.focus();
    },
    [mounted],
  );

  const editor = (
    <JsonEditor
      value={value}
      onChange={onChange}
      language={LANGUAGE_ID}
      path={path}
      height={height}
      beforeMount={(monaco) => ensureJinjaSupport(monaco)}
      onMount={onMount}
      options={EDITOR_OPTIONS}
    />
  );

  if (!showPreview) return editor;

  return (
    <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
      <Stack gap={0}>{editor}</Stack>
      <TemplatePreviewPanel
        output={output}
        preview={preview}
        rendering={rendering}
        error={previewError}
        onJump={jump}
      />
    </SimpleGrid>
  );
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as Record<string, unknown>;
    if (typeof body.detail === 'string') return body.detail;
    return Object.entries(body)
      .map(
        ([key, message]) =>
          `${key}: ${Array.isArray(message) ? message.join(' ') : String(message)}`,
      )
      .join('; ');
  }
  return error instanceof Error ? error.message : String(error);
}

export interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  eventId: string | number;
  context: TemplateContextName;
  output: TemplatePreviewOutput;
  showPreview?: boolean;
  height?: number | string;
}

export function TemplateEditor({
  value,
  onChange,
  eventId,
  context,
  output,
  showPreview = true,
  height,
}: TemplateEditorProps) {
  const description = useTemplateDescription(eventId);
  const request = useMemo(
    () => (showPreview ? { context, template: value, output } : null),
    [showPreview, context, value, output],
  );
  const preview = useTemplatePreview(eventId, request);

  return (
    <TemplateEditorView
      value={value}
      onChange={onChange}
      context={context}
      output={output}
      description={description.data}
      preview={preview.data}
      rendering={preview.isFetching}
      previewError={preview.error ? requestErrorMessage(preview.error) : null}
      showPreview={showPreview}
      height={height}
    />
  );
}
