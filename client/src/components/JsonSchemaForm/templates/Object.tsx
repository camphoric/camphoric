import React from 'react';
import CustomDescriptionField from '../fields/Description';
import { getSchemaValue } from '../utils';

/**
 * Modified version of DefaultObjectFieldTemplate from react-jsonschema-form:
 * - wrap properties in a div which can be assigned classes via
 *   'contentClassNames' in uiSchema
 * - don't bother with 'expandable' option
 *
 * See https://react-jsonschema-form.readthedocs.io/en/latest/advanced-customization/#object-field-template
 */
export default function ObjectFieldTemplate(props: any) {
  const { TitleField } = props;
  const title = getSchemaValue(props, 'title');
  const description = getSchemaValue(props, 'description');
  const contentClassNames = getSchemaValue(props, 'contentClassNames');

  return (
    <fieldset id={props.idSchema.$id}>
      {!!title && (
        <TitleField
          id={`${props.idSchema.$id}__title`}
          title={title}
          required={props.required}
          formContext={props.formContext}
        />
      )}
      {props.description && (
        <CustomDescriptionField
          id={`${props.idSchema.$id}__description`}
          description={description}
        />
      )}
      <div className={contentClassNames || "content"}>
          {props.properties.map((prop: any) => prop.content)}
      </div>
    </fieldset>
  );
}
