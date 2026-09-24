/**
 * Select that shows its description (SPEC §9.1). The @rjsf/mantine base
 * SelectWidget never renders a field's description — only its text inputs do —
 * so dropdowns lost their help text. This wraps the base widget in the shared
 * WidgetFrame, which supplies the label and the description between the label
 * and the control.
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
      <BaseSelect {...props} hideLabel options={{ ...props.options, description: undefined }} />
    </WidgetFrame>
  );
}
