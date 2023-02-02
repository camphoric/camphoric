import React from 'react';
import { FieldProps, UiSchema, ArrayFieldTemplateProps } from '@rjsf/core';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { ordinal } from 'utils/display';
import DescriptionField from './Description';

function CampersField(props: ArrayFieldTemplateProps<any>) {
  return (
    <div>
      {
        props.items && props.items.map((camperProps: any, i: number) => (
          <div className="camphoric-camper" key={camperProps.index}>
            <div className="d-flex flex-row justify-content-between align-items-end">
              <h5>{ordinal(i+1)} Camper</h5>
              <Button
                variant="danger"
                onClick={camperProps.onDropIndexClick(camperProps.index)}
              >Remove {ordinal(i+1)} Camper</Button>
            </div>
            <hr />
            {camperProps.children}
          </div>
        ))
      }
      {
        props.canAdd && (
          <>
            <hr />
            <Button
              className="array-item-add"
              onClick={props.onAddClick}
              disabled={props.disabled || props.readonly}
            >Add A {ordinal(props.items.length + 1)} Camper</Button>
          </>
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
