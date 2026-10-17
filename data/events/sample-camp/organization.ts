import type { OrganizationImport } from '@camphoric/camphoric-event-import-spec';

// A made-up organization. Its email account uses Django's console backend,
// so the confirmation emails the sample registrations queue are written to
// the worker's log, never sent.
export default {
  organization: {
    name: 'Sample Camp Association',
  },
  emailAccount: {
    name: 'Sample Camp',
    backend: 'django.core.mail.backends.console.EmailBackend',
    host: 'localhost',
    port: '1025',
    username: 'registrar@example.com',
    password: 'not-a-real-password',
  },
} satisfies OrganizationImport;
