import { defineEventE2EConfig } from '@camphoric/camphoric-event-import-tools/e2e';

// In this repository the tests run the packages' source (npm run e2e passes
// the camphoric-source condition). Run any other way (npx playwright test,
// its UI or an editor's), Playwright would load their dist/ build, which can
// be stale, so it stops instead.
const tools = import.meta.resolve('@camphoric/camphoric-event-import-tools/e2e');
if (!tools.endsWith('.ts')) {
  throw new Error(
    `Playwright loaded import-tools from its build (${tools}), not its source: `
    + 'run these tests with npm run e2e, or set NODE_OPTIONS=--conditions=camphoric-source',
  );
}

// The registration form's end-to-end tests (e2e/), against a throwaway
// Camphoric with Sample Camp imported. They run the import-tools page object
// against the real form, so a client change that breaks it fails here.
export default defineEventE2EConfig({ globalSetup: './e2e/global-setup.ts' });
