import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it } from 'vitest';

import { CanEdit, permissionsFor, PermissionsProvider, ReadOnlyFieldset } from '../permissions';

describe('permissionsFor', () => {
  it('gives each role what it may do', () => {
    expect(permissionsFor('admin')).toEqual({
      role: 'admin',
      canEdit: true,
      canDeletePayments: true,
      canManageUsers: true,
      canManageOrganizations: true,
    });
    expect(permissionsFor('registrar')).toMatchObject({
      canEdit: true,
      canDeletePayments: false,
      canManageUsers: false,
      canManageOrganizations: false,
    });
    expect(permissionsFor('reporter')).toMatchObject({ canEdit: false, canManageUsers: false });
    expect(permissionsFor(null)).toMatchObject({ canEdit: false });
  });
});

function Form() {
  return (
    <>
      <ReadOnlyFieldset>
        <input aria-label="Name" />
        <button type="button">Pick</button>
      </ReadOnlyFieldset>
      <CanEdit>
        <button type="button">Save</button>
      </CanEdit>
    </>
  );
}

describe('CanEdit and ReadOnlyFieldset', () => {
  it('leave everything alone without a provider (the public site, stories)', () => {
    renderWithProviders(<Form />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('hide and disable for a Reporter', () => {
    renderWithProviders(
      <PermissionsProvider userRole="reporter">
        <Form />
      </PermissionsProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pick' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('allow a Registrar', () => {
    renderWithProviders(
      <PermissionsProvider userRole="registrar">
        <Form />
      </PermissionsProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
