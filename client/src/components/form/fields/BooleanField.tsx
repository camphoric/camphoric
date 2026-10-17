/**
 * Boolean field that renders a dropdown when its choices are labeled (SPEC
 * §9.1). rjsf renders every boolean as a checkbox unless the uiSchema picks a
 * widget, but an event author who titled the options ("No, I am not yet a
 * member" / "Yes, I am a current member" — via `ui:enumNames` or `oneOf`
 * titles) meant those words to be shown, and a checkbox can't. Such fields
 * default to the select widget; an explicit `ui:widget` still wins.
 */

import { getDefaultRegistry } from '@rjsf/core';
import { type FieldProps, getUiOptions } from '@rjsf/utils';

const BaseBooleanField = getDefaultRegistry().fields.BooleanField;

function hasLabeledChoices(props: FieldProps): boolean {
  const { schema, uiSchema } = props;
  // `ui:enumNames` is an array (by index) or a map (by value).
  const uiNames: unknown = getUiOptions(uiSchema).enumNames;
  if (Array.isArray(uiNames) || (typeof uiNames === 'object' && uiNames !== null)) return true;
  const alternatives = schema.oneOf ?? schema.anyOf;
  return (
    Array.isArray(alternatives) &&
    alternatives.some((alternative) => typeof alternative !== 'boolean' && !!alternative.title)
  );
}

export function BooleanField(props: FieldProps) {
  if (!hasLabeledChoices(props) || getUiOptions(props.uiSchema).widget) {
    return <BaseBooleanField {...props} />;
  }
  return <BaseBooleanField {...props} uiSchema={{ ...props.uiSchema, 'ui:widget': 'select' }} />;
}
