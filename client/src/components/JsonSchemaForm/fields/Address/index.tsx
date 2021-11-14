import React from 'react';
import { FieldProps } from '@rjsf/core';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import Form from 'react-bootstrap/Form';
import AddressField from './AddressField';

export type Keys = 'street_address' | 'city' | 'state_or_province' | 'zip_code';

export type FormData = {
  [K in (Keys | 'country')]?: string;
}

export interface CountrySchema extends JSONSchema7 {
  title: string;
  enum: string[];
  default: string;
}

export interface AddressSchema extends JSONSchema7 {
  properties: {
    [K in Keys]: JSONSchema7Definition;
  } & {
    'country': CountrySchema | boolean;
  };
}

export interface Props extends FieldProps<FormData> {
  schema: AddressSchema;
  formData: FormData;
}

const Address = (props: Props) => {
  const { TitleField } = props.registry.fields;
  const { SelectWidget } = props.registry.widgets;
  const title = props.schema.title || props.uiSchema["ui:title"] || props.title;

  const makeOnChange = (name: string) => ({
    target: { value },
  }: React.ChangeEvent<HTMLInputElement>) =>
    props.onChange({
      ...props.formData,
      [name]: value === '' ? props.options?.emptyValue : value,
    });

  const onChangeWholeAddress = (address: FormData) => {
    props.onChange(address);
  };

  const keys: Array<Keys> = [
    'street_address',
    'city',
    'state_or_province',
    'zip_code',
  ];

  const countrySchema = props.schema.properties?.country;

  return (
    <Form.Group id={props.idSchema.$id} className="address">
      <TitleField
        {...props}
        id={`${props.idSchema.$id}__title`}
        title={title}
      />
      <div className="jsonschema-address">
        {keys.map((key: Keys) => (
          <AddressField
            idBase={props.idSchema.$id}
            key={key}
            {...props}
            name={key}
            value={props.formData[key]}
            onChange={makeOnChange(key)}
            onChangeWholeAddress={onChangeWholeAddress}
          />
        ))}
        {!!countrySchema && typeof countrySchema !== "boolean" && (
          <div className="country">
            <SelectWidget
              schema={countrySchema}
              id={`${props.idSchema.$id}__country`}
              options={{
                enumOptions: countrySchema.enum?.map((str: string) => ({
                  value: str,
                  label: str,
                })),
              }}
              label="Country"
              required
              value={props.formData.country}
              onChange={makeOnChange("country")}
              uiSchema={props.uiSchema.country}
              disabled={false}
              readonly={false}
              autofocus={false}
              formContext={{}}
              multiple={false}
              rawErrors={[]}
              onBlur={() => {}}
              onFocus={() => {}}
              placeholder="Country"
              registry={props.registry}
            />
          </div>
        )}
      </div>
    </Form.Group>
  );
}


export default Address;
