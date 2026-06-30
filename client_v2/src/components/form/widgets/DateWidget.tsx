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

import { widgetCommon } from './widgetProps';

const DEFAULT_DISPLAY_FORMAT = 'MM/DD/YYYY';

export function DateWidget(props: WidgetProps) {
  const { id, label, required, placeholder, disabled, error, value, options } =
    widgetCommon<string>(props);
  const { onChange, onBlur, onFocus } = props;

  return (
    <DateInput
      id={id}
      label={label}
      required={required}
      disabled={disabled}
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
