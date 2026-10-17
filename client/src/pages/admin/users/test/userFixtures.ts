/** Sample users for the Users screen's tests and stories. */

import type { ApiManagedUser } from 'api-types';

export function sampleUser(fields: Partial<ApiManagedUser> = {}): ApiManagedUser {
  return {
    id: 2,
    username: 'pat',
    email: 'pat@example.com',
    first_name: 'Pat',
    last_name: 'Alpha',
    role: 'registrar',
    django_access: 'regular',
    is_active: true,
    last_login: '2026-09-20T15:00:00Z',
    date_joined: '2026-01-10T12:00:00Z',
    has_password: true,
    ...fields,
  };
}

export const SAMPLE_USERS: ApiManagedUser[] = [
  sampleUser({
    id: 1,
    username: 'root',
    first_name: '',
    last_name: '',
    role: 'admin',
    django_access: 'superuser',
    email: 'root@example.com',
  }),
  sampleUser(),
  sampleUser({
    id: 3,
    username: 'sam',
    first_name: 'Sam',
    last_name: 'Beta',
    role: 'reporter',
    email: 'sam@example.com',
    has_password: false,
    last_login: null,
  }),
  sampleUser({
    id: 4,
    username: 'kim',
    first_name: 'Kim',
    last_name: '',
    role: null,
    email: 'kim@example.com',
    is_active: false,
  }),
];
