import { defineEventE2EConfig } from '@camphoric/camphoric-event-import-tools/e2e';

// The registration form's end-to-end tests (e2e/), against a throwaway
// Camphoric with Sample Camp imported. They run the import-tools page object
// against the real form, so a client change that breaks it fails here.
export default defineEventE2EConfig({ globalSetup: './e2e/global-setup.ts' });
