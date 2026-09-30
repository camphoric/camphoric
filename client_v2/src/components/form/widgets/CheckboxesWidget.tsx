/**
 * Checkboxes that save their choices in option order (SPEC §9.1, §15 DR-66).
 * The @rjsf/mantine base CheckboxesWidget reports the ticked values in the
 * order they were clicked — Mantine's Checkbox.Group appends each new one — so
 * a camper who ticks Fri, then Sun, then Sat is saved as that list, and every
 * email and report that lists it shows the days out of order. This wraps the
 * base widget and puts the reported values back in the schema's option order.
 */

import { Widgets } from '@rjsf/mantine';
import type { EnumOptionsType, WidgetProps } from '@rjsf/utils';
import { enumOptionsIndexForValue, enumOptionsValueForIndex } from '@rjsf/utils';

const BaseCheckboxes = Widgets.CheckboxesWidget;

/** The chosen values, reordered to follow the options they came from. */
export function inOptionOrder(value: unknown, enumOptions: EnumOptionsType[] = []): unknown {
  if (!Array.isArray(value)) return value;
  const indexes = enumOptionsIndexForValue(value, enumOptions, true) as string[];
  return enumOptionsValueForIndex(indexes, enumOptions);
}

export function CheckboxesWidget(props: WidgetProps) {
  const { onChange, options } = props;
  return (
    <BaseCheckboxes
      {...props}
      onChange={(value: unknown) => onChange(inOptionOrder(value, options.enumOptions))}
    />
  );
}
