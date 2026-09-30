/**
 * Checkboxes that show their description and save their choices in option
 * order (SPEC §9.1, §15 DR-66).
 *
 * The @rjsf/mantine base CheckboxesWidget never renders a field's description,
 * so this wraps it in the shared WidgetFrame, which supplies the label and the
 * description between the label and the checkboxes.
 *
 * The base widget also reports the ticked values in the order they were
 * clicked — Mantine's Checkbox.Group appends each new one — so a camper who
 * ticks Fri, then Sun, then Sat is saved as that list, and every email and
 * report that lists it shows the days out of order. This puts the reported
 * values back in the schema's option order.
 */

import { Widgets } from '@rjsf/mantine';
import type { EnumOptionsType, WidgetProps } from '@rjsf/utils';
import { enumOptionsIndexForValue, enumOptionsValueForIndex } from '@rjsf/utils';

import { WidgetFrame } from './WidgetFrame';

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
    <WidgetFrame {...props}>
      {/* The frame renders the label; a `ui:description` string would otherwise
          be forwarded to Mantine's Checkbox.Group as its `description` prop,
          bypassing the template, so it is dropped here. */}
      <BaseCheckboxes
        {...props}
        hideLabel
        options={{ ...options, description: undefined }}
        onChange={(value: unknown) => onChange(inOptionOrder(value, options.enumOptions))}
      />
    </WidgetFrame>
  );
}
