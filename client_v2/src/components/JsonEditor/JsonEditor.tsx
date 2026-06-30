/**
 * Monaco-based JSON/code editor (SPEC §9.6, DR-8). Monaco is lazy-loaded so it
 * isn't in the registration entry bundle (§11) — it loads only when an editor
 * first opens (a schema editor in Settings, a report template, etc.).
 */

import { useComputedColorScheme } from '@mantine/core';
import { InlineLoading } from 'components/Loading';
import { lazy, Suspense } from 'react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Editor language; defaults to JSON. */
  language?: string;
  height?: number | string;
}

export function JsonEditor({ value, onChange, language = 'json', height = 400 }: JsonEditorProps) {
  const colorScheme = useComputedColorScheme('light');

  return (
    <Suspense fallback={<InlineLoading message="Loading editor…" />}>
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        theme={colorScheme === 'dark' ? 'vs-dark' : 'light'}
        onChange={(next) => onChange(next ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          tabSize: 2,
        }}
      />
    </Suspense>
  );
}
