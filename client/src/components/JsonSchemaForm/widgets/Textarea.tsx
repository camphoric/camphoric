// A copy of the following with the _onChange altered so that it automatically
// truncates on maxLength

import { ChangeEvent, FocusEvent } from 'react';
import { ariaDescribedByIds, FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import Form from 'react-bootstrap/Form';
import CustomDescriptionField from '../fields/Description';
import { getSchemaValue } from '../utils';

type CustomWidgetProps<T = any, S extends StrictRJSFSchema = RJSFSchema, F extends FormContextType = any> = WidgetProps<
  T,
  S,
  F
> & {
  options: any;
};

export default function TextareaWidget<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>({
  id,
  placeholder,
  value,
  required,
  disabled,
  autofocus,
  readonly,
  onBlur,
  onFocus,
  onChange,
  options,
  rawErrors = [],
  ...props
}: CustomWidgetProps<T, S, F>) {
  const _onChange = ({ target: { value } }: ChangeEvent<HTMLTextAreaElement>) => {
    const { maxLength } = options;
    let val = value === '' ? options.emptyValue : value;
    val = val && val.toString();

    // truncate on maxLength
    if (maxLength && typeof val === 'string' && val.length > maxLength) {
      val = val.substring(0, Number(maxLength));
    }
    
    onChange(val);
  }
  const _onBlur = ({ target: { value } }: FocusEvent<HTMLTextAreaElement>) => onBlur(id, value);
  const _onFocus = ({ target: { value } }: FocusEvent<HTMLTextAreaElement>) => onFocus(id, value);

  const title = props.label || getSchemaValue(props, 'title');
  const description = getSchemaValue(props, 'description');

  return (
    <Form.Group>
      <Form.Label className={rawErrors.length > 0 ? "text-danger" : ""}>
        {title}
        {title && required ? "*" : null}
      </Form.Label>
      {description && (
        <CustomDescriptionField
          description={description}
        />
      )}
      <Form.Control
        id={id}
        name={id}
        as='textarea'
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        value={value || ''}
        required={required}
        autoFocus={autofocus}
        rows={options.rows || 5}
        onChange={_onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}
        aria-describedby={ariaDescribedByIds<T>(id)}
      />
    </Form.Group>
  );
}
