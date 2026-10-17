/**
 * Monaco-based JSON/code editor (SPEC §9.6, DR-8). Monaco is bundled with the
 * app (DR-58) and lazy-loaded so it isn't in the registration entry bundle
 * (§11) — it loads only when an editor first opens (a schema editor in
 * Settings, a report template, etc.).
 *
 * `path`, `beforeMount`, `onMount` and `options` pass through to Monaco, so
 * richer editors (the template editor) can build on this one.
 *
 * It's read-only for a user who can't change data (a Reporter; DR-51) unless
 * `readOnly` says otherwise.
 */

import { useComputedColorScheme } from '@mantine/core';
import type { BeforeMount, EditorProps, OnMount } from '@monaco-editor/react';
import { InlineLoading } from 'components/Loading';
import { usePermissions } from 'hooks/permissions';
import { lazy, Suspense, useEffect, useRef } from 'react';

const MonacoEditor = lazy(() => import('./monaco'));

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Editor language; defaults to JSON. */
  language?: string;
  height?: number | string;
  /** The model's URI path; give each editor a unique one to keep models apart. */
  path?: string;
  beforeMount?: BeforeMount;
  onMount?: OnMount;
  /** Extra Monaco options, merged over the defaults. */
  options?: EditorProps['options'];
  /** Default: read-only when the user can't change data. */
  readOnly?: boolean;
}

type Editor = Parameters<OnMount>[0];

/** Replace the editor's text as one undoable edit (a model edit, so it also
 * lands in a read-only editor). */
function replaceText(editor: Editor, text: string) {
  const model = editor.getModel();
  if (!model || text === model.getValue()) return;
  model.pushStackElement();
  model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
  model.pushStackElement();
}

export function JsonEditor({
  value,
  onChange,
  language = 'json',
  height = 400,
  path,
  beforeMount,
  onMount,
  options,
  readOnly,
}: JsonEditorProps) {
  const colorScheme = useComputedColorScheme('light');
  const { canEdit } = usePermissions();

  // Monaco owns the text while it's open; `value` is pushed in only when it
  // changes from outside (a reset, a newly loaded record). React renders
  // onChange updates later, so typing can run ahead of `value`, and a `value`
  // this editor reported itself is an echo of older text. Pushing that back —
  // as @monaco-editor/react does with a controlled `value` — would drop what
  // was typed since and throw the cursor to the end.
  const editorRef = useRef<Editor | null>(null);
  const valueRef = useRef(value);
  const emitted = useRef(new Set<string>());
  const applying = useRef(false);

  const apply = (editor: Editor, text: string) => {
    applying.current = true;
    try {
      replaceText(editor, text);
    } finally {
      applying.current = false;
    }
  };

  useEffect(() => {
    valueRef.current = value;
    const editor = editorRef.current;
    if (emitted.current.has(value)) {
      // Our own text; once the parent has caught up, the older echoes are done.
      if (value === editor?.getValue()) emitted.current.clear();
      return;
    }
    emitted.current.clear();
    if (editor) apply(editor, value);
  }, [value]);

  return (
    <Suspense fallback={<InlineLoading message="Loading editor…" />}>
      <MonacoEditor
        height={height}
        language={language}
        defaultValue={value}
        path={path}
        beforeMount={beforeMount}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          // `value` may have moved on while Monaco loaded.
          apply(editor, valueRef.current);
          onMount?.(editor, monaco);
        }}
        theme={colorScheme === 'dark' ? 'vs-dark' : 'light'}
        onChange={(next = '') => {
          if (applying.current) return;
          emitted.current.add(next);
          onChange(next);
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          tabSize: 2,
          ...options,
          readOnly: readOnly ?? !canEdit,
        }}
      />
    </Suspense>
  );
}
