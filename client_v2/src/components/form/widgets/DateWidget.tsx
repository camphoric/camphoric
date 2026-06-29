/**
 * Date widget (SPEC §9.1) overriding the @rjsf/mantine base so dates **display**
 * as MM/DD/YYYY while the stored form-data value stays ISO `YYYY-MM-DD`.
 *
 * In Mantine 8, `DateInput`'s `value`/`onChange` are ISO date strings and
 * `valueFormat` controls only the displayed (and typed-input) format — so the
 * value round-trips as ISO with no conversion. An event's uiSchema can override
 * the display via `ui:options: { displayFormat: '…' }`.
 */

import { DateInput } from '@mantine/dates';
import type { WidgetProps } from '@rjsf/utils';

const DEFAULT_DISPLAY_FORMAT = 'MM/DD/YYYY';

interface DateOptions {
  emptyValue?: unknown;
  displayFormat?: string;
}

export function DateWidget(props: WidgetProps) {
  const { id, onChange, onBlur, onFocus, label, required, disabled, readonly, placeholder } = props;
  const value = props.value as string | undefined;
  const options = props.options as DateOptions;
  const error = props.rawErrors && props.rawErrors.length > 0 ? props.rawErrors.join('\n') : undefined;

  return (
    <DateInput
      id={id}
      label={label || undefined}
      required={required}
      disabled={disabled || readonly}
      placeholder={placeholder}
      error={error}
      valueFormat={options.displayFormat ?? DEFAULT_DISPLAY_FORMAT}
      value={value ?? null}
      onChange={(next) => onChange(next ?? options.emptyValue)}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
    />
  );
}
