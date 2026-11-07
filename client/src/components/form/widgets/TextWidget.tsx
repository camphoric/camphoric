/**
 * rjsf's default widget for strings and numbers (`text`) (SPEC §9.1). A
 * `number` or `integer` field gets NumberWidget, so every number field keeps to
 * its schema's limits without naming a widget (§15, DR-161); anything else gets
 * the theme's BaseInputTemplate, as rjsf's own TextWidget renders it.
 */

import { getTemplate, type WidgetProps } from '@rjsf/utils';

import { isNumberSchema, NumberWidget } from './NumberWidget';

export function TextWidget(props: WidgetProps) {
  if (isNumberSchema(props.schema)) return <NumberWidget {...props} />;
  const BaseInputTemplate = getTemplate('BaseInputTemplate', props.registry, props.options);
  // eslint-disable-next-line react-hooks/static-components -- the registry's template, the same component every render
  return <BaseInputTemplate {...props} />;
}
