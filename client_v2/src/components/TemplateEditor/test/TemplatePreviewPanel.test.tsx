import userEvent from '@testing-library/user-event';
import type { TemplatePreviewResponse } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { TemplatePreviewPanel } from '../TemplatePreviewPanel';

const preview = (overrides: Partial<TemplatePreviewResponse> = {}): TemplatePreviewResponse => ({
  output: 'Name,Cabin\nPat,Cabin A\n',
  diagnostics: [],
  truncated: false,
  duration_ms: 12,
  sample: null,
  ...overrides,
});

describe('TemplatePreviewPanel', () => {
  it('shows csv output as a table', () => {
    renderWithProviders(<TemplatePreviewPanel output="csv" preview={preview()} />);
    expect(screen.getByRole('columnheader', { name: 'Cabin' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Pat' })).toBeInTheDocument();
    expect(screen.getByText(/12 ms/)).toBeInTheDocument();
  });

  it('renders markdown sanitized', () => {
    renderWithProviders(
      <TemplatePreviewPanel
        output="md"
        preview={preview({ output: '# Roster\n<img src=x onerror="alert(1)">' })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
    expect(document.querySelector('[onerror]')).toBeNull();
  });

  it('lists problems and jumps to their line', async () => {
    const onJump = vi.fn();
    const diagnostics = [
      {
        severity: 'warning',
        kind: 'undefined',
        message: "camper has no field 'frist'",
        field: 'template',
        line: 3,
        column: 7,
      },
      {
        severity: 'error',
        kind: 'syntax',
        message: 'unexpected end of template',
        field: 'template',
        line: 5,
        column: null,
      },
    ] as const;
    renderWithProviders(
      <TemplatePreviewPanel
        output="txt"
        preview={preview({ output: '', diagnostics: [...diagnostics], truncated: true })}
        onJump={onJump}
      />,
    );
    const items = screen.getAllByRole('listitem');
    // Errors first.
    expect(items[0]).toHaveTextContent('Line 5: unexpected end of template');
    expect(items[1]).toHaveTextContent("Line 3, column 7: camper has no field 'frist'");
    await userEvent.click(screen.getByText("camper has no field 'frist'"));
    expect(onJump).toHaveBeenCalledWith(diagnostics[0]);
    expect(screen.getByText(/too long to preview/)).toBeInTheDocument();
  });

  it('reports a failed request and an empty result', () => {
    const { rerender } = renderWithProviders(
      <TemplatePreviewPanel output="txt" error="context: Unknown context" />,
    );
    expect(screen.getByText('context: Unknown context')).toBeInTheDocument();
    rerender(<TemplatePreviewPanel output="txt" preview={preview({ output: '  ' })} />);
    expect(screen.getByText('The template produced no output.')).toBeInTheDocument();
  });
});
