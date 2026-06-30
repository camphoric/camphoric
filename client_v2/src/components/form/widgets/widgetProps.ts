/**
 * Shared helpers for the custom widgets (SPEC §9.1). rjsf's `WidgetProps` is
 * intentionally loose; these collapse the boilerplate each widget would
 * otherwise repeat — the value cast, error derivation, and disabled/readonly
 * merge — into one place.
 */

import type { WidgetProps } from '@rjsf/utils';

export interface WidgetOptions {
  emptyValue?: unknown;
  rows?: number;
  displayFormat?: string;
}

/** rjsf passes errors as a string array; join them for a single error message. */
export function widgetError(rawErrors?: string[]): string | undefined {
  return rawErrors && rawErrors.length > 0 ? rawErrors.join('\n') : undefined;
}

/** The common, typed slice of a widget's props. */
export function widgetCommon<T>(props: WidgetProps) {
  return {
    id: props.id,
    label: props.label || undefined,
    required: props.required,
    placeholder: props.placeholder,
    disabled: props.disabled || props.readonly,
    error: widgetError(props.rawErrors),
    value: props.value as T | undefined,
    options: props.options as WidgetOptions,
  };
}
