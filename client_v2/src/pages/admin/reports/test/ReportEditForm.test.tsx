import userEvent from '@testing-library/user-event';
import type { ApiReport } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportEditForm } from '../ReportEditForm';

const { create, update } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));

vi.mock('store/entities', () => ({
  reportHooks: {
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutate: update, isPending: false }),
  },
}));

// Monaco doesn't load in jsdom; textareas stand in for both editors.
vi.mock('components/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="JSON" value={value} onChange={(e) => onChange(e.currentTarget.value)} />
  ),
}));
vi.mock('components/TemplateEditor', () => ({
  TemplateEditor: ({
    value,
    onChange,
    output,
  }: {
    value: string;
    onChange: (value: string) => void;
    output: string;
  }) => (
    <textarea
      aria-label={`Jinja template (${output})`}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  ),
}));

const legacyReport = {
  id: 3,
  event: 7,
  title: 'Roster',
  output: 'hbs',
  template: '{{#each campers}}{{/each}}',
  variables_schema: { a: 1 },
  variables_source: 'client',
} as unknown as ApiReport;

beforeEach(() => {
  create.mockClear();
  update.mockClear();
});

describe('ReportEditForm', () => {
  it('creates new reports with Camphoric variables and the template editor', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportEditForm eventId="7" onDone={vi.fn()} />);

    expect(screen.queryByText('Variables schema')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Cabins');
    await user.type(screen.getByLabelText('Jinja template (csv)'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: '7',
        title: 'Cabins',
        output: 'csv',
        template: 'x',
        variables_source: 'server',
      }),
      expect.anything(),
    );
  });

  it('keeps legacy reports on the plain editor with the variables schema', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportEditForm eventId="7" report={legacyReport} onDone={vi.fn()} />);

    expect(screen.getByText('Variables schema')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Jinja template/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, variables_source: 'client', variables_schema: { a: 1 } }),
      expect.anything(),
    );
  });

  it('confirms before switching a saved template to Camphoric variables', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportEditForm eventId="7" report={legacyReport} onDone={vi.fn()} />);

    await user.click(screen.getByRole('textbox', { name: 'Variables' }));
    await user.click(
      await screen.findByRole('option', { name: /Camphoric variables/, hidden: true }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('will need rewriting');
    await user.click(screen.getByRole('button', { name: 'Change' }));

    // Handlebars isn't available with server variables.
    expect(await screen.findByLabelText('Jinja template (csv)')).toBeInTheDocument();
    expect(screen.queryByText('Variables schema')).not.toBeInTheDocument();
  });
});
