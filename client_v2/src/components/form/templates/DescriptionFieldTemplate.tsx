/**
 * Renders schema/uiSchema descriptions as templated markdown (SPEC §9.1, the
 * "Description" custom field in the v4 reference). String descriptions run
 * through the Handlebars + markdown Template against the form's `templateData`;
 * non-string descriptions (already-rendered nodes) pass through.
 */

import type { DescriptionFieldProps } from '@rjsf/utils';
import { useTemplateData } from 'components/form/context';
import { Template } from 'components/templating';

export function DescriptionFieldTemplate({ id, description }: DescriptionFieldProps) {
  const templateData = useTemplateData();

  if (description === undefined || description === null || description === '') {
    return null;
  }

  if (typeof description === 'string') {
    return (
      <div id={id} className="field-description">
        <Template markdown={description} templateVars={templateData} />
      </div>
    );
  }

  return (
    <div id={id} className="field-description">
      {description}
    </div>
  );
}
