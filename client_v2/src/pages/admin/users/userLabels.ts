/** How users' groups and Django access read on the Users screen (SPEC §8.10). */

import type { DjangoAccess, Role } from 'api-types';
import { ROLE_LABEL } from 'hooks/permissions';

/** The Camphoric permission group choices ('none': no access). */
export const GROUP_OPTIONS: { value: Role | 'none'; label: string }[] = [
  { value: 'admin', label: `${ROLE_LABEL.admin}: everything, including users` },
  { value: 'registrar', label: `${ROLE_LABEL.registrar}: everything except users` },
  { value: 'reporter', label: `${ROLE_LABEL.reporter}: read-only` },
  { value: 'none', label: 'No access' },
];

export const DJANGO_ACCESS_LABEL: Record<DjangoAccess, string> = {
  regular: 'Regular user',
  staff: 'Staff (for developers)',
  superuser: 'Superuser (for developers)',
};

export function groupLabel(role: Role | null) {
  return role ? ROLE_LABEL[role] : 'No access';
}
