/**
 * The Jinja template editor (SPEC §9.6, DR-36): Monaco with Jinja
 * highlighting, autocomplete and hover docs for the variables this kind of
 * template receives, problems underlined in the text, and a live preview
 * rendered by the server against the event's real data. The preview can be
 * hidden to give the editor the full width, and the whole editor can be
 * expanded to fill the screen.
 *
 * `TemplateEditor` fetches the variable spec and the preview;
 * `TemplateEditorView` takes them as props (for stories and tests).
 */

import {
  Anchor,
  Box,
  Button,
  Drawer,
  getDefaultZIndex,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import type { OnMount } from '@monaco-editor/react';
import {
  IconArrowsMaximize,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconHelp,
} from '@tabler/icons-react';
import type {
  TemplateContextName,
  TemplateDescription,
  TemplateDiagnostic,
  TemplatePreviewOutput,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
} from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import { type InsertHandler, TemplateHelpPanel } from 'components/TemplateHelp';
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
  /** Offer Template Help beside the editor. */
  showHelp?: boolean;
  /** The standalone Template Help page, linked from the help panel. */
  helpHref?: string;
  height?: number | string;
  /** Names the template in the expanded view. */
  title?: string;
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
  showHelp = true,
  helpHref,
  height = 360,
  title = 'Template',
}: TemplateEditorViewProps) {
  const [helpOpen, help] = useDisclosure(false);
  const [expanded, expand] = useDisclosure(false);
  const [previewHidden, setPreviewHidden] = useState(false);
  const previewShown = showPreview && !previewHidden;
  const sideBySide = useMediaQuery('(min-width: 62em)');
  const id = useId().replace(/\W/g, '');
  const path = `camphoric-template/${context}/${id}.jinja`;
  const expandedPath = `camphoric-template/${context}/${id}-expanded.jinja`;
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
      if (!mounted || !d.line || d.field !== 'template') return;
      mounted.editor.revealLineInCenter(d.line);
      mounted.editor.setPosition({ lineNumber: d.line, column: d.column ?? 1 });
      mounted.editor.focus();
    },
    [mounted],
  );

  // Insert at the cursor (replacing any selection); tag snippets expand.
  const insert = useCallback<InsertHandler>(
    (text, options) => {
      if (!mounted) return;
      const { editor } = mounted;
      editor.focus();
      if (options?.snippet) {
        const snippets = editor.getContribution<
          { insert(text: string): void } & MonacoEditor.IEditorContribution
        >('snippetController2');
        snippets?.insert(text);
        return;
      }
      const selection = editor.getSelection();
      if (selection)
        editor.executeEdits('template-help', [{ range: selection, text, forceMoveMarkers: true }]);
    },
    [mounted],
  );

  // Problems stay underlined while the preview is hidden; say how many there are.
  const problems = preview?.diagnostics.length ?? 0;

  const toolbar = (inExpandedView: boolean) => (
    <Group justify="flex-end" gap="xs">
      {showPreview && (
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={previewHidden ? <IconEye size={16} /> : <IconEyeOff size={16} />}
          onClick={() => setPreviewHidden((hidden) => !hidden)}
        >
          {previewHidden
            ? `Show preview${problems ? ` (${problems} ${problems === 1 ? 'problem' : 'problems'})` : ''}`
            : 'Hide preview'}
        </Button>
      )}
      {!inExpandedView && (
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconArrowsMaximize size={16} />}
          onClick={expand.open}
        >
          Expand
        </Button>
      )}
      {showHelp && (
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={<IconHelp size={16} />}
          onClick={help.toggle}
        >
          Template help
        </Button>
      )}
    </Group>
  );

  const helpDrawer = showHelp && (
    <Drawer
      opened={helpOpen}
      onClose={help.close}
      position="right"
      size="lg"
      title="Template help"
      // Above the expanded view (and any modal the editor sits in).
      zIndex={getDefaultZIndex('modal') + 1}
      // Keep the editor usable while help is open, so entries can be inserted.
      withOverlay={false}
      lockScroll={false}
      trapFocus={false}
      closeOnClickOutside={false}
    >
      <Stack>
        {helpHref && (
          <Anchor href={helpHref} target="_blank" size="sm">
            <Group gap={4}>
              Open the full help page <IconExternalLink size={14} />
            </Group>
          </Anchor>
        )}
        <TemplateHelpPanel description={description} context={context} onInsert={insert} />
      </Stack>
    </Drawer>
  );

  // Inline or expanded, whichever was mounted last is the one `mounted` drives.
  // Each has its own model (and path): the expanded one stays mounted while
  // its modal closes, and unmounting disposes its model.
  const editor = (editorHeight: number | string, editorPath: string) => (
    <JsonEditor
      value={value}
      onChange={onChange}
      language={LANGUAGE_ID}
      path={editorPath}
      height={editorHeight}
      beforeMount={(monaco) => ensureJinjaSupport(monaco)}
      onMount={onMount}
      options={EDITOR_OPTIONS}
    />
  );

  const previewPanel = (
    <TemplatePreviewPanel
      output={output}
      preview={preview}
      rendering={rendering}
      error={previewError}
      onJump={jump}
    />
  );

  // The same tree whether or not the preview shows, so toggling it doesn't
  // remount Monaco (losing the cursor and undo history).
  const inline = (
    <SimpleGrid cols={previewShown ? { base: 1, xl: 2 } : 1} spacing="md">
      <Stack gap={0}>{editor(height, path)}</Stack>
      {previewShown && previewPanel}
    </SimpleGrid>
  );

  const splitColumns = previewShown && sideBySide;
  const splitRows = previewShown && !sideBySide;

  return (
    <Stack gap="xs">
      {expanded ? (
        <Text size="sm" c="dimmed">
          Editing in the expanded view.
        </Text>
      ) : (
        <>
          {toolbar(false)}
          {inline}
        </>
      )}
      <Modal
        opened={expanded}
        onClose={expand.close}
        closeButtonProps={{ 'aria-label': 'Close' }}
        title={title}
        fullScreen
        // Escape belongs to Monaco (dismissing suggestions and hovers).
        closeOnEscape={false}
        styles={{
          content: { display: 'flex', flexDirection: 'column' },
          body: {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--mantine-spacing-xs)',
          },
        }}
      >
        {toolbar(true)}
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gap: 'var(--mantine-spacing-md)',
            gridTemplateColumns: splitColumns ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            gridTemplateRows: splitRows ? 'minmax(0, 3fr) minmax(0, 2fr)' : 'minmax(0, 1fr)',
          }}
        >
          <Box h="100%">{editor('100%', expandedPath)}</Box>
          {previewShown && <Box style={{ overflow: 'auto' }}>{previewPanel}</Box>}
        </Box>
      </Modal>
      {helpDrawer}
    </Stack>
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

/** Which record a preview renders for (the server picks one when omitted). */
export type PreviewSample = Pick<
  TemplatePreviewRequest,
  'registration_id' | 'camper_id' | 'invitation_id' | 'registration_type_id' | 'invoice_id'
>;

export interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  eventId: string | number;
  context: TemplateContextName;
  output: TemplatePreviewOutput;
  /** An email's subject template, previewed with the body. */
  subject?: string;
  sample?: PreviewSample;
  showPreview?: boolean;
  showHelp?: boolean;
  helpHref?: string;
  height?: number | string;
  /** Names the template in the expanded view. */
  title?: string;
}

export function TemplateEditor({
  value,
  onChange,
  eventId,
  context,
  output,
  subject,
  sample,
  showPreview = true,
  showHelp,
  helpHref,
  height,
  title,
}: TemplateEditorProps) {
  const description = useTemplateDescription(eventId);
  // Callers often pass a fresh `sample` object; key on its contents so the
  // debounced preview request only changes when something real does.
  const sampleKey = JSON.stringify(sample ?? {});
  const request = useMemo<TemplatePreviewRequest | null>(
    () =>
      showPreview
        ? {
            context,
            template: value,
            output,
            ...(subject !== undefined ? { subject } : {}),
            ...(JSON.parse(sampleKey) as PreviewSample),
          }
        : null,
    [showPreview, context, value, output, subject, sampleKey],
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
      showHelp={showHelp}
      helpHref={helpHref}
      height={height}
      title={title}
    />
  );
}
