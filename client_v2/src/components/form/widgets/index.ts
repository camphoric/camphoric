/**
 * Custom widget registry layered on the @rjsf/mantine base theme (SPEC §9.1).
 *
 * The base theme already covers most of the v4 reference's custom widgets —
 * Select (with enumDisabled + type coercion), Checkboxes (inline + enumDisabled),
 * and text/integer/datalist inputs (BaseInputTemplate). Only the genuinely
 * additive behaviors are provided here:
 *   - PhoneInput        — international phone input (no base equivalent)
 *   - NaturalNumberInput — digits-only non-negative integer input
 *   - TextareaWidget    — overrides the base textarea to enforce maxLength
 *   - DateWidget        — overrides the base date widget to display MM/DD/YYYY
 *                         while storing ISO YYYY-MM-DD
 *
 * Widgets are keyed by the names event uiSchemas reference (the v4 names, e.g.
 * `ui:widget: 'PhoneInput'`); lowercase aliases are also provided. The base
 * theme already supplies SelectWidget / CheckboxesWidget / TextWidget.
 */

import type { RegistryWidgetsType } from '@rjsf/utils';

import { DateWidget } from './DateWidget';
import { NaturalNumberInput } from './NaturalNumberInput';
import { PhoneInput } from './PhoneInput';
import { TextareaWidget } from './TextareaWidget';

export const customWidgets: RegistryWidgetsType = {
  // Names used by existing event uiSchemas.
  PhoneInput,
  NaturalNumberInput,
  TextareaWidget,
  DateWidget,
  // Lowercase aliases.
  phone: PhoneInput,
  naturalNumber: NaturalNumberInput,
  textarea: TextareaWidget,
  date: DateWidget,
};

export { DateWidget, NaturalNumberInput, PhoneInput, TextareaWidget };
