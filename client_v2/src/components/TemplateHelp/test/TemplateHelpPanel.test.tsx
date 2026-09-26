import userEvent from '@testing-library/user-event';
import { sampleDescription as description } from 'components/TemplateEditor/sampleDescription';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { TemplateHelpPanel } from '../TemplateHelpPanel';

describe('TemplateHelpPanel', () => {
  it('lists the context’s variables and the types they lead to', () => {
    renderWithProviders(<TemplateHelpPanel description={description} context="report" />);
    expect(screen.getByRole('heading', { name: 'Reports variables' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'attributes:camper' })).toBeInTheDocument();
    expect(screen.getAllByText('this event').length).toBeGreaterThan(0);
  });

  it('searches, and inserts what’s chosen', async () => {
    const onInsert = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TemplateHelpPanel description={description} context="report" onInsert={onInsert} />,
    );

    await user.type(screen.getByLabelText('Search help'), 'nights');
    expect(screen.queryByRole('heading', { name: 'attributes:camper' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Insert nights' }));
    expect(onInsert).toHaveBeenCalledWith('.nights');

    await user.click(screen.getByRole('tab', { name: 'Filters, tests and tags' }));
    await user.clear(screen.getByLabelText('Search help'));
    await user.type(screen.getByLabelText('Search help'), 'money');
    await user.click(screen.getByRole('button', { name: 'Insert filter money' }));
    expect(onInsert).toHaveBeenLastCalledWith(' | money', { snippet: undefined });
  });

  it('shows a guide topic', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TemplateHelpPanel description={description} context="report" tab="guide" topic="computed" />,
    );
    expect(screen.getByRole('heading', { name: 'Computed values' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Variables' }));
  });
});
