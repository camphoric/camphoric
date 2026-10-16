import userEvent from '@testing-library/user-event';
import type { ApiReport } from 'api-types';
import { renderWithProviders, screen } from 'test/utils';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportEditForm } from '../ReportEditForm';

const { create, update } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn((body: object) => Promise.resolve(body)),
}));

const openEditConflict = vi.hoisted(() => vi.fn());
vi.mock('components/EditConflict', () => ({ openEditConflict }));
vi.mock('hooks/useEditLease', async () => (await import('test/leases')).mockEditLease);
vi.mock('store/entities', () => ({
  reportHooks: {
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutateAsync: update, isPending: false }),
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
  version: 4,
} as unknown as ApiReport;

beforeEach(() => {
  create.mockClear();
  update.mockClear();
});

describe('ReportEditForm', () => {
  it('creates new reports with Camphoric variables and the template editor', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportEditForm eventId="7" onSaved={vi.fn()} onCancel={vi.fn()} />);

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
    const onSaved = vi.fn();
    renderWithProviders(
      <ReportEditForm eventId="7" report={legacyReport} onSaved={onSaved} onCancel={vi.fn()} />,
    );

    expect(screen.getByText('Variables schema')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Jinja template/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    // Only what changed is sent: nothing did, so nothing is, and it's done.
    expect(update).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(3);
  });

  it('confirms before switching a saved template to Camphoric variables', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReportEditForm eventId="7" report={legacyReport} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

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

  it('tells the page whether it differs from the saved report', async () => {
    const onDirtyChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ReportEditForm
        eventId="7"
        report={legacyReport}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(screen.getByLabelText('Title'), '!');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.type(screen.getByLabelText('Title'), '{Backspace}');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('shows what someone else saved while nothing here is unsaved, and not over edits', async () => {
    const user = userEvent.setup();
    const props = { eventId: '7', onSaved: vi.fn(), onCancel: vi.fn() };
    const { rerender } = renderWithProviders(<ReportEditForm {...props} report={legacyReport} />);

    rerender(
      <ReportEditForm {...props} report={{ ...legacyReport, version: 5, title: 'Cabins' }} />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Cabins');

    await user.type(screen.getByLabelText('Title'), '!');
    rerender(
      <ReportEditForm {...props} report={{ ...legacyReport, version: 6, title: 'Bunks' }} />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Cabins!');

    // Saved from the version shown, so only the title goes, with no conflict to ask about.
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith({ id: 3, version: 5, title: 'Cabins!' });
  });

  it('has nothing unsaved after taking theirs over mine', async () => {
    const user = userEvent.setup();
    const theirs = { ...legacyReport, version: 5, title: 'Cabins' };
    update.mockRejectedValueOnce(
      new ApiError(412, 'Precondition Failed', { code: 'version_conflict', current: theirs }),
    );
    openEditConflict.mockResolvedValueOnce('discard');
    const onDirtyChange = vi.fn();
    renderWithProviders(
      <ReportEditForm
        eventId="7"
        report={legacyReport}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.type(screen.getByLabelText('Title'), '!');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByLabelText('Title')).toHaveValue('Cabins');
    // So the edit lease, and the page's leaving prompt, are given up.
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
