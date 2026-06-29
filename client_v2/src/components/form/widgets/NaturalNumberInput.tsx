/**
 * Digits-only number widget (SPEC §9.1) — a non-negative integer input. Built on
 * Mantine's NumberInput with negatives and decimals disabled so only natural
 * numbers can be entered.
 */

import { NumberInput } from '@mantine/core';
import type { WidgetProps } from '@rjsf/utils';

interface NaturalNumberOptions {
  emptyValue?: unknown;
}

export function NaturalNumberInput(props: WidgetProps) {
  const { id, onChange, onBlur, onFocus, label, required, disabled, readonly, placeholder } = props;
  const value = props.value as number | undefined;
  const options = props.options as NaturalNumberOptions;
  const error = props.rawErrors && props.rawErrors.length > 0 ? props.rawErrors.join('\n') : undefined;

  return (
    <NumberInput
      id={id}
      label={label || undefined}
      required={required}
      disabled={disabled || readonly}
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
