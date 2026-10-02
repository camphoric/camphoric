import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { act, renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { useUnsavedChanges } from '../useUnsavedChanges';

function Editor({ onClose = () => {} }: { onClose?: () => void }) {
  const [text, setText] = useState('');
  const { confirmDiscard } = useUnsavedChanges(text !== '');
  return (
    <>
      <input aria-label="Template" value={text} onChange={(e) => setText(e.currentTarget.value)} />
      <button type="button" onClick={() => confirmDiscard(onClose)}>
        Cancel
      </button>
    </>
  );
}

function renderInRouter() {
  // The router restores scroll on each navigation; jsdom can't scroll.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const root = createRootRoute();
  const routes = [
    createRoute({ getParentRoute: () => root, path: '/', component: () => <Editor /> }),
    createRoute({ getParentRoute: () => root, path: '/other', component: () => <p>Elsewhere</p> }),
  ];
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  renderWithProviders(<RouterProvider router={router} />);
  // A link or the back button goes through the history, as this does.
  return { leave: () => act(() => void router.history.push('/other')) };
}

describe('useUnsavedChanges', () => {
  it('goes ahead without asking when nothing changed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Editor onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before dropping changes, and goes ahead only on discard', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Editor onClose={onClose} />);
    await user.type(screen.getByLabelText('Template'), 'x');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('your changes will be lost');
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('holds a navigation away until the changes are discarded', async () => {
    const user = userEvent.setup();
    const { leave } = renderInRouter();
    await user.type(await screen.findByLabelText('Template'), 'x');

    leave();
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Template')).toHaveValue('x');
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument();

    leave();
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByText('Elsewhere')).toBeInTheDocument();
  });
});
