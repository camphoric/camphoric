import React from 'react';
import Form from 'react-bootstrap/Form';
import { WidgetProps } from '@rjsf/core';
import CustomDescriptionField from '../fields/Description';
import { getSchemaValue } from '../utils';

export interface TextWidgetProps extends WidgetProps {
  type?: string;
}

const TextWidget = (props: TextWidgetProps) => {
  const {
    id,
    required,
    readonly,
    disabled,
    type,
    label,
    value,
    onChange,
    onBlur,
    onFocus,
    autofocus,
    options,
    schema,
    rawErrors = [],
  } = props;

  const _onChange = ({
    target: { value },
  }: React.ChangeEvent<HTMLInputElement>) =>
    onChange(value === "" ? options.emptyValue : value);
  const _onBlur = ({ target: { value } }: React.FocusEvent<HTMLInputElement>) =>
    onBlur(id, value);
  const _onFocus = ({
    target: { value },
  }: React.FocusEvent<HTMLInputElement>) => onFocus(id, value);

  const title = label || getSchemaValue(props, 'title');
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
        autoFocus={autofocus}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        className={rawErrors.length > 0 ? "is-invalid" : ""}
        list={schema.examples ? `examples_${id}` : undefined}
        type={type || (schema.type as string)}
        value={value || value === 0 ? value : ""}
        onChange={_onChange}
        onBlur={_onBlur}
        onFocus={_onFocus}

      />
      {schema.examples ? (
        <datalist id={`examples_${id}`}>
          {(schema.examples as string[])
            .concat(schema.default ? ([schema.default] as string[]) : [])
            .map((example: any) => {
              return <option key={example} value={example} />;
            })}
        </datalist>
      ) : null}
    </Form.Group>
  );
};

export default TextWidget;
