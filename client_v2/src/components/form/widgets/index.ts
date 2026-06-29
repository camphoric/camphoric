/**
 * Custom widget registry layered on the @rjsf/mantine base theme (SPEC §9.1).
 *
 * The base theme already covers most of the v4 reference's custom widgets —
 * Select (with enumDisabled + type coercion), Checkboxes (inline + enumDisabled),
 * and text/integer/datalist inputs (BaseInputTemplate). Only the genuinely
 * additive behaviors are provided here:
 *   - `phone`         — international phone input (no base equivalent)
 *   - `naturalNumber` — digits-only non-negative integer input
 *   - `textarea`      — overrides the base textarea to enforce maxLength
 *   - `date`          — overrides the base date widget to display MM/DD/YYYY
 *                       while storing ISO YYYY-MM-DD
 */

import type { RegistryWidgetsType } from '@rjsf/utils';

import { DateWidget } from './DateWidget';
import { NaturalNumberInput } from './NaturalNumberInput';
import { PhoneInput } from './PhoneInput';
import { TextareaWidget } from './TextareaWidget';

export const customWidgets: RegistryWidgetsType = {
  phone: PhoneInput,
  naturalNumber: NaturalNumberInput,
  textarea: TextareaWidget,
  date: DateWidget,
};

export { DateWidget, NaturalNumberInput, PhoneInput, TextareaWidget };
