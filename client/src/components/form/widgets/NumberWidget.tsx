/**
 * Number widget (SPEC §9.1, §15 DR-161): every `number` and `integer` field
 * without a `ui:widget` of its own (see TextWidget). Mantine's NumberInput, with
 * the schema's limits applied so a registrant's answer is never changed under
 * them:
 *   - a `minimum` of 0 or more: the minus sign can't be typed;
 *   - `type: integer`: the decimal point can't be typed;
 *   - any other value outside `minimum` / `maximum` stays as typed and is
 *     rejected with the field's limit message. It's never clamped on blur, as
 *     Mantine does by default (#988): a value below a `minimum` of 5 can't be
 *     blocked at the keyboard, since typing 12 passes through 1.
 * A saved value the keyboard rules wouldn't let in (`-5`, saved before a
 * `minimum` of 0 was added) is shown as it is, not stripped to `5`, so its
 * limit message makes sense.
 * The `ui:options` events give number fields (`prefix: '$'`, …) still apply.
 * WidgetFrame supplies the label and the (markdown) description (#987).
 */

import { NumberInput, type NumberInputProps } from '@mantine/core';
import { getSchemaType, type RJSFSchema, type WidgetProps } from '@rjsf/utils';

import { WidgetFrame } from './WidgetFrame';
import { widgetCommon } from './widgetProps';

/** The NumberInput settings a schema's limits call for. */
export interface NumberLimits {
  min?: number;
  max?: number;
  /** The schema's `multipleOf`: the step controls' step. */
  step?: number;
  allowNegative: boolean;
  allowDecimal: boolean;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** Whether a schema is for a number (`number` or `integer`, perhaps nullable). */
export function isNumberSchema(schema: RJSFSchema): boolean {
  const type = getSchemaType(schema);
  return type === 'number' || type === 'integer';
}

export function numberLimits(schema: RJSFSchema): NumberLimits {
  const min = numberOrUndefined(schema.minimum);
  const lowest = min ?? numberOrUndefined(schema.exclusiveMinimum);
  return {
    min,
    max: numberOrUndefined(schema.maximum),
    step: numberOrUndefined(schema.multipleOf),
    allowNegative: lowest === undefined || lowest < 0,
    allowDecimal: getSchemaType(schema) !== 'integer',
  };
}

/** The `ui:options` a number field may set that NumberInput takes as props. */
const INPUT_OPTIONS = [
  'prefix',
  'suffix',
  'thousandSeparator',
  'decimalSeparator',
  'decimalScale',
  'fixedDecimalScale',
  'hideControls',
  'step',
] as const;

type InputOptions = Pick<NumberInputProps, (typeof INPUT_OPTIONS)[number]>;

function inputOptions(options: Record<string, unknown>): InputOptions {
  // The event's JSON config, passed through unchecked, as rjsf's base number input did.
  return Object.fromEntries(
    INPUT_OPTIONS.filter((key) => options[key] !== undefined).map((key) => [key, options[key]]),
  );
}

/** A number input with the given limits, for NumberWidget and NaturalNumberInput. */
export function LimitedNumberInput({
  widgetProps,
  limits,
}: {
  widgetProps: WidgetProps;
  limits: NumberLimits;
}) {
  const { id, required, placeholder, disabled, error, value, options } = widgetCommon<
    number | string
  >(widgetProps);
  const { onChange, onBlur, onFocus, htmlName } = widgetProps;
  const saved = typeof value === 'number' ? value : undefined;

  return (
    <WidgetFrame {...widgetProps}>
      <NumberInput
        id={id}
        name={htmlName || id}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        error={error}
        step={limits.step}
        {...inputOptions(widgetProps.options)}
        // A string while it isn't a number yet (`-`, `1.`): rjsf's NumberField
        // keeps it on screen, and validation rejects it if it's left that way.
        value={value ?? ''}
        min={limits.min}
        max={limits.max}
        allowNegative={limits.allowNegative || (saved !== undefined && saved < 0)}
        allowDecimal={limits.allowDecimal || (saved !== undefined && !Number.isInteger(saved))}
        clampBehavior="none"
        onChange={(next) => onChange(next === '' ? options.emptyValue : next)}
        onBlur={() => onBlur(id, value)}
        onFocus={() => onFocus(id, value)}
      />
    </WidgetFrame>
  );
}

export function NumberWidget(props: WidgetProps) {
  return <LimitedNumberInput widgetProps={props} limits={numberLimits(props.schema)} />;
}
