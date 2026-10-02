/**
 * What the signed-in user may do in the admin (SPEC §6; §15 DR-50, DR-51), from
 * their Camphoric permission group. The server enforces the same rules; the UI
 * hides or disables what a role can't do so nobody meets a refusal.
 *
 * The context's default is unrestricted: the admin shell provides the real
 * value, while the public registration pages, stories and tests that render
 * components on their own keep everything enabled.
 */

import type { Role } from 'api-types';
import { createContext, type ReactNode, useContext } from 'react';

export interface Permissions {
  role: Role | null;
  /** Create, edit, delete and send (Registrars and Admins). */
  canEdit: boolean;
  /** Delete payments and invoices (Admins; §15, DR-93). Registrars cancel invoices. */
  canDeletePayments: boolean;
  /** The Users screen (Admins). */
  canManageUsers: boolean;
  /** Create, rename and delete organizations (Admins). */
  canManageOrganizations: boolean;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  registrar: 'Registrar',
  reporter: 'Reporter',
};

export function permissionsFor(role: Role | null): Permissions {
  return {
    role,
    canEdit: role === 'admin' || role === 'registrar',
    canDeletePayments: role === 'admin',
    canManageUsers: role === 'admin',
    canManageOrganizations: role === 'admin',
  };
}

const PermissionsContext = createContext<Permissions>(permissionsFor('admin'));

export function PermissionsProvider({
  userRole,
  children,
}: {
  userRole: Role | null;
  children: ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={permissionsFor(userRole)}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}

/** Renders its children only for users who may change data. */
export function CanEdit({ children }: { children: ReactNode }) {
  return usePermissions().canEdit ? <>{children}</> : null;
}

/**
 * Disables every native control inside (inputs, selects, buttons) for users who
 * can't change data — one wrapper for a form's body. Leaves layout untouched.
 */
export function ReadOnlyFieldset({ children }: { children: ReactNode }) {
  const { canEdit } = usePermissions();
  return (
    <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {children}
    </fieldset>
  );
}
