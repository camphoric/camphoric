import userEvent from '@testing-library/user-event';
import type { ApiContractSection } from 'api-types';
import { renderWithProviders, screen, within } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { ContractDraftEditor } from '../ContractDraftEditor';
import { DRAFT_SECTIONS } from './contractVersions';

function renderEditor(saved: ApiContractSection[] = DRAFT_SECTIONS) {
  const handlers = { onSave: vi.fn(), onPublish: vi.fn(), onDelete: vi.fn() };
  renderWithProviders(
    <ContractDraftEditor organizationName="Lark Camp" saved={saved} nextNumber={2} {...handlers} />,
  );
  return handlers;
}

describe('ContractDraftEditor', () => {
  it('can’t remove the privacy policy, but can remove another section', () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: 'Remove Privacy Policy' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Liability Waiver' })).toBeInTheDocument();
  });

  it('saves the sections, added, edited and moved, in their new order', async () => {
    const { onSave } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Move Liability Waiver up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add a section' }));
    const titles = screen.getAllByLabelText('Title');
    await userEvent.type(titles[2], 'Acceptable use');
    await userEvent.type(screen.getAllByLabelText(/Text/)[2], 'Keep camper data private.');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(onSave).toHaveBeenCalledWith([
      DRAFT_SECTIONS[1],
      DRAFT_SECTIONS[0],
      { kind: 'custom', title: 'Acceptable use', body: 'Keep camper data private.' },
    ]);
  });

  it('publishes only once saved, and after saying everyone must agree again', async () => {
    const { onPublish } = renderEditor();
    await userEvent.type(screen.getAllByLabelText('Title')[1], '!');
    expect(screen.getByRole('button', { name: 'Publish…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish…' }));
    const confirm = screen.getByRole('alert');
    expect(confirm).toHaveTextContent('Everyone — you included — will need to agree');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Publish version 2' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('won’t publish a section without a title or text', () => {
    renderEditor([{ kind: 'privacy_policy', title: 'Privacy Policy', body: '' }]);
    expect(screen.getByRole('button', { name: 'Publish…' })).toBeDisabled();
    expect(screen.getByText(/Give every section a title and some text/)).toBeInTheDocument();
  });

  it('previews the text as it will be shown', async () => {
    renderEditor();
    await userEvent.click(screen.getByText('Preview'));
    expect(screen.getByRole('region', { name: 'Liability Waiver' })).toHaveTextContent(
      'Use at your own risk.',
    );
  });
});
