/**
 * Select that shows its description (SPEC §9.1). The @rjsf/mantine base
 * SelectWidget never renders a field's description — only its text inputs do —
 * so dropdowns lost their help text. This wraps the base widget in the shared
 * WidgetFrame, which supplies the label and the description between the label
 * and the control.
 *
 * Choosing the option that's already chosen keeps it (Mantine's default clears
 * it, which emptied answers people only meant to look at, on touch screens
 * especially). An optional dropdown is cleared with its clear button instead.
 * `ui:options` can still set either.
 */

import { Widgets } from '@rjsf/mantine';
import type { WidgetProps } from '@rjsf/utils';

import { WidgetFrame } from './WidgetFrame';

const BaseSelect = Widgets.SelectWidget;

export function SelectWidget(props: WidgetProps) {
  return (
    <WidgetFrame {...props}>
      {/* The frame renders the label; a `ui:description` string would otherwise
          be forwarded straight to Mantine's `description` prop, bypassing the
          template, so it is dropped here. */}
      <BaseSelect
        {...props}
        hideLabel
        options={{
          allowDeselect: false,
          clearable: !props.required,
          ...props.options,
          description: undefined,
        }}
      />
    </WidgetFrame>
  );
}
