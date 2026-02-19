import React from 'react';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import { WidgetProps } from '@rjsf/core';
import ErrorBoundary from 'components/ErrorBoundary';
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
    label,
    onChange,
    onBlur,
    onFocus,
    autofocus,
    options,
    schema,
    rawErrors = [],
  } = props;

  const isIntegerInput = (props.type || schema.type) === 'integer';

  const _onChange = ({
    target: { value },
  }: React.ChangeEvent<HTMLInputElement>) => {
    let finalValue = value;

    if (isIntegerInput) {
      finalValue = finalValue.toString().replace(/\D/g, '');
    }

    console.log('finalValue', finalValue);
    onChange(finalValue === "" ? options.emptyValue : finalValue);
  }
  const _onBlur = ({ target: { value } }: React.FocusEvent<HTMLInputElement>) =>
    onBlur(id, value);
  const _onFocus = ({
    target: { value },
  }: React.FocusEvent<HTMLInputElement>) => onFocus(id, value);

  let value = props.value;
  const title = label || getSchemaValue(props, 'title');
  const description = getSchemaValue(props, 'description');
  const prefix = getSchemaValue(props, 'prefix');

  const typeProps = {
    type: props.type || (schema.type as string),
    step: undefined as undefined | string,
    pattern: undefined as undefined | string,
  }

  if (isIntegerInput) {
    typeProps.type = 'text';
    value = value ? value.toString().replace(/\D/g,'') : "";
  }

  return (
    <ErrorBoundary>
      <Form.Group>
        <Form.Label className={rawErrors.length > 0 ? "text-danger" : ""}>
          {title}
          {title && required ? "*" : null}
        </Form.Label>
        {!!description && (
          <CustomDescriptionField
            description={description}
          />
        )}
        <InputGroup>
          {!!prefix && (
            <InputGroup.Prepend>
              <InputGroup.Text>{prefix}</InputGroup.Text>
            </InputGroup.Prepend>
          )}

          <Form.Control
            id={id}
            autoFocus={autofocus}
            required={required}
            disabled={disabled}
            readOnly={readonly}
            className={rawErrors.length > 0 ? "is-invalid" : ""}
            list={schema.examples ? `examples_${id}` : undefined}
            value={value || (value === 0 ? value : "")}
            onChange={_onChange}
            onBlur={_onBlur}
            onFocus={_onFocus}
            {...typeProps}

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
        </InputGroup>
      </Form.Group>
    </ErrorBoundary>
  );
};

export default TextWidget;
