// A copy of the following with the _onChange altered so that it automatically
// truncates on maxLength

import { ChangeEvent, FocusEvent } from 'react';
import { ariaDescribedByIds, FormContextType, RJSFSchema, StrictRJSFSchema, WidgetProps } from '@rjsf/utils';
import FormControl from 'react-bootstrap/FormControl';
import InputGroup from 'react-bootstrap/InputGroup';

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

  return (
    <InputGroup>
      <FormControl
        id={id}
        name={id}
        as='textarea'
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        value={value}
        required={required}
        autoFocus={autofocus}
        rows={options.rows || 5}
        onChange={_onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}
        aria-describedby={ariaDescribedByIds<T>(id)}
      />
    </InputGroup>
  );
}
