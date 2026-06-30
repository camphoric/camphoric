/**
 * Template data context for the form engine (SPEC §9.1). The form wrapper
 * exposes a `templateData` object to descendants so description fields can
 * render templated (Handlebars + markdown) help text against the event's
 * template variables.
 */

import { createContext, useContext } from 'react';

export type TemplateData = Record<string, unknown>;

const TemplateDataContext = createContext<TemplateData>({});

export const TemplateDataProvider = TemplateDataContext.Provider;

export function useTemplateData(): TemplateData {
  return useContext(TemplateDataContext);
}
