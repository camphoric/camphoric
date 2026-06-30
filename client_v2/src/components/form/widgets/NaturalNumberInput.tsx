/**
 * Digits-only number widget (SPEC §9.1) — a non-negative integer input. Built on
 * Mantine's NumberInput with negatives and decimals disabled so only natural
 * numbers can be entered.
 */

import { NumberInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';

import { widgetCommon } from './widgetProps';

export function NaturalNumberInput(props: WidgetProps) {
  const { id, label, required, placeholder, disabled, error, value, options } =
    widgetCommon<number>(props);
  const { onChange, onBlur, onFocus } = props;

  return (
    <NumberInput
      id={id}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      error={error}
      value={typeof value === 'number' ? value : ''}
      allowNegative={false}
      allowDecimal={false}
      min={0}
      hideControls
      onChange={(next) => onChange(next === '' ? options.emptyValue : Number(next))}
      onBlur={() => onBlur(id, value)}
      onFocus={() => onFocus(id, value)}
    />
  );
}
