/**
 * Digits-only number widget (SPEC §9.1), chosen with
 * `ui:widget: 'NaturalNumberInput'`: a non-negative whole number, whatever the
 * schema's type and limits say. Otherwise it's NumberWidget: the schema's own
 * `minimum` (when above 0) and `maximum` apply, as do its `ui:options`; the
 * controls are hidden unless they say otherwise.
 */

import type { WidgetProps } from '@rjsf/utils';

import { LimitedNumberInput, numberLimits } from './NumberWidget';

export function NaturalNumberInput(props: WidgetProps) {
  const limits = numberLimits(props.schema);
  return (
    <LimitedNumberInput
      widgetProps={{ ...props, options: { hideControls: true, ...props.options } }}
      limits={{
        ...limits,
        min: Math.max(limits.min ?? 0, 0),
        allowNegative: false,
        allowDecimal: false,
      }}
    />
  );
}
