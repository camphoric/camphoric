import React from 'react';
import { FieldProps, UiSchema, ArrayFieldTemplateProps } from '@rjsf/core';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import DescriptionField from './Description';

function CampersField(props: ArrayFieldTemplateProps<any>) {
  return (
    <div>
      {
        props.items && props.items.map((camperProps: any) => (
          <div className="camphoric-camper" key={camperProps.index}>
            <Button
              variant="danger"
              className="camphoric-camper-remove"
              onClick={camperProps.onDropIndexClick(camperProps.index)}
            >X</Button>
            {camperProps.children}
          </div>
        ))
      }
      {
        props.canAdd && (
          <Button
            className="array-item-add"
            onClick={props.onAddClick}
            disabled={props.disabled || props.readonly}
          >Add Camper</Button>
        )
      }
    </div>
  );
}

export default function Campers(props: FieldProps<any>) {
  const { SchemaField, TitleField } = props.registry.fields;

  // Re-render this as the above CampersField component
  const uiSchema: UiSchema = {
    ...props.uiSchema,
    'ui:field': undefined,
    'ui:ArrayFieldTemplate': CampersField,
  };

  return (
    <Form.Group className="camphoric-campers">
      <TitleField {...props} id={`${props.idSchema.$id}__title`} title="Campers" />
      <DescriptionField id={`${props.idSchema.$id}__description`} description={props.uiSchema["ui:description"] || props.schema.description} />
      <SchemaField {...props} uiSchema={uiSchema} />
    </Form.Group>
  );
}
