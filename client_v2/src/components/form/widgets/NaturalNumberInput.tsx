/**
 * Digits-only number widget (SPEC §9.1) — a non-negative integer input. Built on
 * Mantine's NumberInput with negatives and decimals disabled so only natural
 * numbers can be entered. WidgetFrame supplies the label and description.
 */

import { NumberInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';

import { WidgetFrame } from './WidgetFrame';
import { widgetCommon } from './widgetProps';

export function NaturalNumberInput(props: WidgetProps) {
  const { id, required, placeholder, disabled, error, value, options } =
    widgetCommon<number>(props);
  const { onChange, onBlur, onFocus } = props;

  return (
    <WidgetFrame {...props}>
      <NumberInput
        id={id}
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
    </WidgetFrame>
  );
}
