import React from 'react';

/**
 * A custom description field that allows HTML by passing an object with an
 * '__html' key.
 *
 * See https://react-jsonschema-form.readthedocs.io/en/latest/advanced-customization/#custom-descriptions
 */
export default function DescriptionField({id, description}: any) {
  if (description instanceof Object && '__html' in description) {
    return <div id={id} className="field-description" dangerouslySetInnerHTML={description} />;
  }
  return <div id={id} className="field-description"><p>{description}</p></div>;
}
