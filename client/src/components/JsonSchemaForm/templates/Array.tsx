import React from 'react';
import Button from 'react-bootstrap/Button';

import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import CustomDescriptionField from '../fields/Description';
import { getSchemaValue, getSchemaItemsValue } from '../utils';

/**
 * Modified version of DefaultObjectFieldTemplate from react-jsonschema-form:
 * - wrap properties in a div which can be assigned classes via
 *   'contentClassNames' in uiSchema
 * - don't bother with 'expandable' option
 *
 * See https://react-jsonschema-form.readthedocs.io/en/latest/advanced-customization/#object-field-template
 */
function ArrayItems (props: any) {
  return (
    <Row className={props.className}>
      <Col xs={11}>{props.children}</Col>
      <Col xs={1} className="d-flex flex-column">
        <Button
          className="remove-array-item"
          onClick={props.onDropIndexClick(props.index)}
          variant="danger"
        >{props.removeText}</Button>
      </Col>
    </Row>
  );
}

export default function ArrayFieldTemplate(props: any) {
  const { TitleField } = props;

  const title = getSchemaValue(props, 'title');
  const description = getSchemaValue(props, 'description');
  const itemTitle = getSchemaItemsValue(props, 'title');
  const addText = getSchemaValue(props, 'addButtonText');
  const removeText = getSchemaValue(props, 'removeButtonText') || 'X';

  return (
    <div id={props.idSchema.$id} className="jsonschema-array">
      {(title) && (
        <TitleField
          id={`${props.idSchema.$id}__title`}
          title={title}
          required={props.required}
          formContext={props.formContext}
        />
      )}
      {description && (
        <CustomDescriptionField
          id={`${props.idSchema.$id}__description`}
          description={description}
        />
      )}
      <div className={`${props.uiSchema.contentClassNames || ''} items`}>
        {
          props.items.map((itemProps: any) => <ArrayItems {...itemProps} removeText={removeText} />)
        }

      </div>
      {
        !!props.canAdd && (
          <Button onClick={props.onAddClick}>{ addText  || `Add ${itemTitle || 'item'}` }</Button>
        )
      }
    </div>
  );
}
