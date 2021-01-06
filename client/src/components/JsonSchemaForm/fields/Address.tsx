import React from 'react';
import { FieldProps } from '@rjsf/core';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import Form from 'react-bootstrap/Form';

type Keys = 'street_address' | 'city' | 'state_or_province' | 'zip_code';

type FormData = {
  [K in (Keys | 'country')]?: string;
}

interface CountrySchema extends JSONSchema7 {
  title: string;
  enum: string[];
  default: string;
}

interface AddressSchema extends JSONSchema7 {
  properties: {
    [K in Keys]: JSONSchema7Definition;
  } & {
    'country': CountrySchema | boolean;
  };
}

interface Props extends FieldProps<FormData> {
  schema: AddressSchema;
  formData: FormData;
}

const Address = (props: Props) => {
  const { TitleField } = props.registry.fields;
  const { SelectWidget } = props.registry.widgets;
  const title = props.schema.title || props.uiSchema["ui:title"] || props.title;

  const _onChange = (name: string) => ({
    target: { value },
  }: React.ChangeEvent<HTMLInputElement>) =>
    props.onChange({
      ...props.formData,
      [name]: value === "" ? props.options.emptyValue : value,
    });

  console.log(props);

  const keys: Array<Keys> = [
    'street_address',
    'city',
    'state_or_province',
    'zip_code',
  ];

  const countrySchema = props.schema.properties?.country;

  return (
    <Form.Group id={props.idSchema.$id} className="address">
      <TitleField {...props} id={`${props.idSchema.$id}__title`} title={title} />
      <div className="jsonschema-address">
        {
          keys.map(
            (key: Keys) => (
              <AddressField
                key={key}
                {...props}
                name={key}
                value={props.formData[key]}
                onChange={_onChange(key)}
              />
            )
          )
        }
        {
          !!countrySchema && typeof countrySchema !== 'boolean' && (
            <div className="country">
              <SelectWidget
                schema={countrySchema}
                id={`${props.idSchema.$id}__country`}
                options={{
                  enumOptions: countrySchema.enum?.map(
                    (str: string) => ({
                      value: str,
                      label: str,
                    }),
                  )
                }}
                label="Country"
                required
                value={props.formData.country}
                onChange={_onChange('country')}
                uiSchema={props.uiSchema.country}
                disabled={false}
                readonly={false}
                autofocus={false}
                formContext={{}}
                multiple={false}
                rawErrors={[]}
                onBlur={() => {}}
                onFocus={() => {}}
              />
            </div>
          )
        }
      </div>
    </Form.Group>
  );
}

interface AddressProps extends Props {
  name: Keys;
  value?: string;
  onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
}

function AddressField (props: AddressProps) {
  const rawErrors = props.rawErrors || [];
  const classes = [
    props.name,
    (rawErrors.length ? 'is-invalid' : ''),
  ].filter(Boolean).join(' ');

  const required = props.schema.required && props.schema.required.includes(props.name);

  const properties = props.schema.properties &&
    props.schema.properties[props.name];

  const label = typeof properties === 'boolean' ? props.name : properties?.title;

  return (
    <Form.Group className={`${props.name} mb-0`}>
      <Form.Label className={rawErrors.length > 0 ? 'text-danger' : ''}>
        {label}{label && props.required ? "*" : null}
      </Form.Label>
      <Form.Control
        required={required}
        className={classes}
        type={props.type || (props.schema.type as string)}
        value={props.value || ''}
        onChange={props.onChange}
      />
    </Form.Group>
  );
}


export default Address;
