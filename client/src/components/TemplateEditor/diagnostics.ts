/**
 * Template diagnostics as Monaco markers (SPEC §9.6): each problem the server
 * reports is underlined on its line — from its column to the end of the word
 * there, or the whole line when the server couldn't tell the column.
 */

import type { TemplateDiagnostic } from 'api-types';
import type { editor } from 'monaco-editor';

/** Monaco's MarkerSeverity values (kept here so this module needn't load Monaco). */
export const MARKER_SEVERITY = { Warning: 4, Error: 8 } as const;

/** The parts of a Monaco text model this needs. */
export interface LineSource {
  getLineCount(): number;
  getLineContent(line: number): string;
}

export function toMarkers(
  diagnostics: TemplateDiagnostic[],
  model: LineSource,
  field = 'template',
): editor.IMarkerData[] {
  const lineCount = model.getLineCount();
  return diagnostics
    .filter((d) => d.field === field && d.line !== null && d.line >= 1)
    .map((d) => {
      const line = Math.min(d.line!, lineCount);
      const text = model.getLineContent(line);
      const firstChar = text.search(/\S/) + 1 || 1;
      let startColumn = firstChar;
      let endColumn = text.length + 1;
      if (d.column && d.column <= text.length) {
        startColumn = d.column;
        const word = /^[\w'[\]]+/.exec(text.slice(d.column - 1));
        endColumn = d.column + (word ? word[0].length : 1);
      }
      if (endColumn <= startColumn) endColumn = startColumn + 1;
      return {
        severity: d.severity === 'error' ? MARKER_SEVERITY.Error : MARKER_SEVERITY.Warning,
        message: d.message,
        source: 'Camphoric',
        startLineNumber: line,
        startColumn,
        endLineNumber: line,
        endColumn,
      };
    });
}
