import { Modal, TextInput } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { anonymousUser, type ApiUser } from 'api-types';
import { SignedOutContext, useCurrentUser, WHOAMI_KEY } from 'hooks/auth';
import { CanEdit, PermissionsProvider } from 'hooks/permissions';
import { type ReactNode, useContext, useState } from 'react';
import { act, renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../AuthGuard';

// Who's signed in comes from the whoami cache each test sets; a re-check never
// answers, so it stays "checking".
vi.mock('utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/fetch')>()),
  apiFetch: () => new Promise(() => undefined),
}));
vi.mock('hooks/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('hooks/auth')>()),
  useLogin: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
vi.mock('hooks/useSessionMonitor', () => ({ useSessionMonitor: () => undefined }));

const user = (fields: Partial<ApiUser>): ApiUser => ({
  ...anonymousUser,
  id: 3,
  username: 'pat',
  is_active: true,
  ...fields,
});

const pat = user({ role: 'registrar' });

/** An editor holding a change it hasn't saved, and a way to sign out on purpose. */
function Editor() {
  const [note, setNote] = useState('');
  const signedOut = useContext(SignedOutContext);
  return (
    <>
      <p>The admin</p>
      <TextInput label="Note" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <button type="button" onClick={signedOut}>
        Sign out
      </button>
    </>
  );
}

/** As the admin shell does: permissions from the current user, inside the guard. */
function Permitted({ children }: { children: ReactNode }) {
  const { data } = useCurrentUser();
  return <PermissionsProvider userRole={data?.role ?? null}>{children}</PermissionsProvider>;
}

function renderGuard(signedIn: ApiUser, children: ReactNode = <p>The admin</p>) {
  const client = new QueryClient();
  client.setQueryData(WHOAMI_KEY, signedIn);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  renderWithProviders(
    <QueryClientProvider client={client}>
      <AuthGuard>{children}</AuthGuard>
    </QueryClientProvider>,
  );
  return {
    client,
    invalidate,
    /** The whoami check comes back with `next`, or (undefined) is under way again. */
    becomes: (next: ApiUser | undefined) =>
      act(async () => {
        if (next) client.setQueryData(WHOAMI_KEY, next);
        else void client.resetQueries({ queryKey: WHOAMI_KEY });
        // The query tells its observers on a later turn.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }),
  };
}

describe('AuthGuard', () => {
  it('asks a signed-out visitor to sign in', () => {
    renderGuard(anonymousUser);
    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells someone without a permission group they have no access', () => {
    renderGuard(user({ role: null }));
    expect(screen.getByRole('heading', { name: 'No access yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByText('The admin')).not.toBeInTheDocument();
  });

  it('lets anyone with a group in', () => {
    renderGuard(user({ role: 'reporter' }));
    expect(screen.getByText('The admin')).toBeInTheDocument();
  });

  it('asks for a new password before anything else when one must be chosen', () => {
    renderGuard(user({ role: 'registrar', must_change_password: true }));
    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.queryByText('The admin')).not.toBeInTheDocument();
  });

  it('keeps unsaved edits through a lost session and signing back in', async () => {
    const { becomes, invalidate } = renderGuard(pat, <Editor />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'half-written');

    await becomes(anonymousUser);
    const dialog = await screen.findByRole('dialog', { name: 'Sign in again' });
    expect(dialog).toContainElement(screen.getByRole('textbox', { name: 'Username' }));
    expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('pat');
    // The admin is still there underneath, but out of reach.
    const note = screen.getByDisplayValue('half-written');
    expect(note.closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await becomes(pat);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('half-written');
    expect(screen.getByRole('textbox', { name: 'Note' }).closest('[inert]')).toBeNull();
    expect(invalidate).toHaveBeenCalled();
  });

  it('keeps edits inside what only editors see, as the signed-out user is still them', async () => {
    const { becomes } = renderGuard(
      pat,
      <Permitted>
        <CanEdit>
          <Editor />
        </CanEdit>
      </Permitted>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'half-written');
    await becomes(anonymousUser);
    await screen.findByRole('dialog', { name: 'Sign in again' });
    expect(screen.getByDisplayValue('half-written')).toBeInTheDocument();
    await becomes(pat);
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('half-written');
  });

  it('makes a dialog left open underneath unreachable', async () => {
    const { becomes } = renderGuard(
      pat,
      <Modal opened onClose={() => undefined} title="Edit camper">
        <TextInput label="Note" />
      </Modal>,
    );
    await becomes(anonymousUser);
    await screen.findByRole('dialog', { name: 'Sign in again' });
    const note = screen.getByRole('textbox', { name: 'Note', hidden: true });
    expect(note.closest('[inert]')).not.toBeNull();

    await becomes(pat);
    expect(screen.getByRole('textbox', { name: 'Note' }).closest('[inert]')).toBeNull();
  });

  it("doesn't let Escape close a dialog left open underneath", async () => {
    const onClose = vi.fn();
    const { becomes } = renderGuard(
      pat,
      <Modal opened onClose={onClose} title="Edit camper">
        <TextInput label="Note" />
      </Modal>,
    );
    await becomes(anonymousUser);
    await screen.findByRole('dialog', { name: 'Sign in again' });
    await userEvent.click(screen.getByLabelText('Password'));
    await userEvent.keyboard('{Escape}');
    // Nor with the focus gone from the prompt.
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Sign in again' })).toBeInTheDocument();

    await becomes(pat);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the admin up while the session is being checked again', async () => {
    const { becomes } = renderGuard(pat, <Editor />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'half-written');
    await becomes(undefined);
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('half-written');
    expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument();
  });

  it('starts the admin afresh when someone else signs back in', async () => {
    const { becomes } = renderGuard(pat, <Editor />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'half-written');
    await becomes(anonymousUser);
    await screen.findByRole('dialog', { name: 'Sign in again' });

    await becomes(user({ id: 4, username: 'sam', role: 'admin' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('');
  });

  it("keeps the user's cached data when they sign back in, and drops it for someone else", async () => {
    const { becomes, client } = renderGuard(pat, <Editor />);
    client.setQueryData(['Event', 1], { name: 'Lark Camp' });
    await becomes(anonymousUser);
    await becomes(pat);
    expect(client.getQueryData(['Event', 1])).toEqual({ name: 'Lark Camp' });

    await becomes(anonymousUser);
    await becomes(user({ id: 4, username: 'sam', role: 'admin' }));
    expect(client.getQueryData(['Event', 1])).toBeUndefined();
  });

  it('keeps the admin up while a 401 has whoami checked again', async () => {
    const { client } = renderGuard(pat, <Editor />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), 'half-written');
    // As the global 401 handler does: the check is under way, its answer not in.
    await act(async () => {
      void client.invalidateQueries({ queryKey: WHOAMI_KEY }, { cancelRefetch: false });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(client.getQueryState(WHOAMI_KEY)?.fetchStatus).toBe('fetching');
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('half-written');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns to the sign-in page after signing out on purpose', async () => {
    const { becomes } = renderGuard(pat, <Editor />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await becomes(anonymousUser);
    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(screen.queryByText('The admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns to the sign-in page when another tab signs out on purpose', async () => {
    const { becomes } = renderGuard(pat, <Editor />);
    const otherTab = new BroadcastChannel('camphoric-signed-out');
    otherTab.postMessage('signed-out');
    otherTab.close();
    // The message arrives on a later turn.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    await becomes(anonymousUser);
    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
