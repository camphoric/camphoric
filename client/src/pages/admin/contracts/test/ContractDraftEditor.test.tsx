import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { ContractDraftEditor } from '../ContractDraftEditor';
import { DRAFT_BODY } from './contractVersions';

function renderEditor(saved: string = DRAFT_BODY) {
  const handlers = { onSave: vi.fn(), onPublish: vi.fn(), onDelete: vi.fn() };
  renderWithProviders(
    <ContractDraftEditor organizationName="Lark Camp" saved={saved} nextNumber={2} {...handlers} />,
  );
  return handlers;
}

describe('ContractDraftEditor', () => {
  it('edits the terms as one Markdown document, and saves it', async () => {
    const { onSave } = renderEditor();
    const terms = screen.getByLabelText(/Terms/);
    expect(terms).toHaveValue(DRAFT_BODY);
    await userEvent.type(terms, '\n\n## Acceptable use\n\nKeep camper data private.');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(onSave).toHaveBeenCalledWith(
      `${DRAFT_BODY}\n\n## Acceptable use\n\nKeep camper data private.`,
    );
  });

  it('publishes only once saved, and after saying everyone must agree again', async () => {
    const { onPublish } = renderEditor();
    await userEvent.type(screen.getByLabelText(/Terms/), '!');
    expect(screen.getByRole('button', { name: 'Publish…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish…' }));
    const confirm = screen.getByRole('alert');
    expect(confirm).toHaveTextContent('Everyone — you included — will need to agree');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Publish version 2' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('won’t publish terms with no text', () => {
    renderEditor('  \n');
    expect(screen.getByRole('button', { name: 'Publish…' })).toBeDisabled();
    expect(screen.getByText('Write the terms before publishing them.')).toBeInTheDocument();
  });

  it('previews the text as it will be shown, its headings its sections', async () => {
    renderEditor();
    await userEvent.click(screen.getByText('Preview'));
    expect(screen.getByRole('heading', { name: 'Liability Waiver' })).toBeInTheDocument();
    expect(screen.getByText('Use at your own risk.')).toBeInTheDocument();
  });
});
