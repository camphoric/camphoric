import userEvent from '@testing-library/user-event';
import type { Role } from 'api-types';
import { PermissionsProvider } from 'hooks/permissions';
import type { ReactNode } from 'react';
import { renderWithProviders, screen, within } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationChooser } from '../OrganizationChooser';

const { create, update, remove } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('store/entities', () => ({
  organizationHooks: {
    useList: () => ({
      data: [
        { id: 1, name: 'Lark' },
        { id: 2, name: 'Harmony' },
      ],
      isLoading: false,
    }),
    useCreate: () => ({ mutate: create, isPending: false }),
    useUpdate: () => ({ mutate: update, isPending: false }),
    useDelete: () => ({ mutate: remove, isPending: false }),
  },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#org">{children}</a>,
}));

beforeEach(() => {
  create.mockClear();
  update.mockClear();
  remove.mockClear();
});

function setup(role: Role) {
  renderWithProviders(
    <PermissionsProvider userRole={role}>
      <OrganizationChooser />
    </PermissionsProvider>,
  );
  return userEvent.setup();
}

describe('OrganizationChooser', () => {
  it('lets an Admin add an organization', async () => {
    const user = setup('admin');
    await user.click(screen.getByRole('button', { name: 'New organization' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), ' Folk Camp ');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(create).toHaveBeenCalledWith({ name: 'Folk Camp' }, expect.anything());
  });

  it('lets an Admin rename and delete one', async () => {
    const user = setup('admin');
    await user.click(screen.getByRole('button', { name: 'Change Harmony' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename', hidden: true }));
    const name = within(await screen.findByRole('dialog')).getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Harmony');
    await user.clear(name);
    await user.type(name, 'Camp Harmony');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(update).toHaveBeenCalledWith({ id: 2, name: 'Camp Harmony' }, expect.anything());
  });

  it('only lists them for a Registrar', () => {
    setup('registrar');
    expect(screen.getByText('Lark')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New organization' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change Lark' })).not.toBeInTheDocument();
  });
});
