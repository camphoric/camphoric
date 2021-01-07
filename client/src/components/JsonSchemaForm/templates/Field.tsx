/**
 * Field Template
 *
 * A field template is basically a React stateless component being passed
 * field-related props, allowing you to structure your form row as you like.
 * This controls the inner organization of each field (each form row).  We do
 * this so that we can use Markdown descriptions.
 *
 * https://react-jsonschema-form.readthedocs.io/en/latest/advanced-customization/custom-templates/#fieldtemplate
 */

import React from 'react';

import { FieldTemplateProps } from '@rjsf/core';

import Form from 'react-bootstrap/Form';
import ListGroup from 'react-bootstrap/ListGroup';

const FieldTemplate = (props: FieldTemplateProps) => {
  const {
    id,
    children,
    displayLabel,
    rawErrors = [],
    rawHelp,
    rawDescription,
  } = props;

  // The typedefs of rjsf are still being refined
  // @ts-expect-error
  const { DescriptionField } = props.fields;

  return (
    <Form.Group>
      {children}
      {
        displayLabel && rawDescription ? (
          <Form.Text className={rawErrors.length > 0 ? 'text-danger' : 'text-muted'}>
            {props.description}
          </Form.Text>
        ) : null
      }
      {
        rawErrors.length > 0 && (
          <ListGroup as="ul">
            {
              rawErrors.map((error: string) => (
                <ListGroup.Item as="li" key={error} className="border-0 m-0 p-0">
                  <small className="m-0 text-danger">
                    <DescriptionField description={error} />
                  </small>
                </ListGroup.Item>
              ))
            }
          </ListGroup>
        )
      }
      {
        rawHelp && (
          <Form.Text
            className={rawErrors.length > 0 ? 'text-danger' : 'text-muted'}
            id={id}
          >
            <DescriptionField description={rawHelp} />
          </Form.Text>
        )
      }
    </Form.Group>
  );
};

export default FieldTemplate;
