import type { TemplateDiagnostic } from 'api-types';
import { describe, expect, it } from 'vitest';

import { MARKER_SEVERITY, toMarkers } from './diagnostics';

const lines = ['first', '  {{ campers[0].frist_name }}', 'third'];
const model = {
  getLineCount: () => lines.length,
  getLineContent: (line: number) => lines[line - 1],
};

const diagnostic = (overrides: Partial<TemplateDiagnostic>): TemplateDiagnostic => ({
  severity: 'error',
  kind: 'undefined',
  message: 'problem',
  field: 'template',
  line: 2,
  column: null,
  ...overrides,
});

describe('toMarkers', () => {
  it('underlines the word at the column', () => {
    const [marker] = toMarkers([diagnostic({ severity: 'warning', column: 17 })], model);
    expect(marker).toMatchObject({
      severity: MARKER_SEVERITY.Warning,
      startLineNumber: 2,
      startColumn: 17,
      endColumn: 17 + 'frist_name'.length,
    });
  });

  it('underlines the line from its first character without a column', () => {
    const [marker] = toMarkers([diagnostic({})], model);
    expect(marker).toMatchObject({
      severity: MARKER_SEVERITY.Error,
      startColumn: 3,
      endColumn: lines[1].length + 1,
    });
  });

  it('skips problems without a line or in another field, and clamps the line', () => {
    const markers = toMarkers(
      [diagnostic({ line: null }), diagnostic({ field: 'subject' }), diagnostic({ line: 9 })],
      model,
    );
    expect(markers).toHaveLength(1);
    expect(markers[0].startLineNumber).toBe(3);
  });
});
