/**
 * Label and description chrome for the custom widgets (SPEC §9.1). Mantine's
 * inputs take a plain-string `description`, but this form's descriptions are
 * templated markdown rendered by DescriptionFieldTemplate, which produces block
 * content that can't go inside Mantine's `<p>`. So each custom widget renders
 * its control without a label and lets this frame supply the label and the
 * description between the label and the control — the same layout, sizing and
 * colours Mantine gives a text input.
 */

import './WidgetFrame.css';

import { Box, Input } from '@mantine/core';
import { descriptionId, getTemplate, type WidgetProps } from '@rjsf/utils';
import type { ReactNode } from 'react';

/** A widget's description: `ui:description` wins over the schema's. */
export function widgetDescription(props: WidgetProps): string | undefined {
  const fromOptions = props.options.description;
  if (typeof fromOptions === 'string' && fromOptions) return fromOptions;
  return props.schema.description || undefined;
}

export function WidgetFrame({ children, ...props }: WidgetProps & { children: ReactNode }) {
  const { id, label, required, hideLabel, schema, uiSchema, registry, options } = props;
  const description = widgetDescription(props);
  const DescriptionFieldTemplate = getTemplate('DescriptionFieldTemplate', registry, options);

  return (
    <Box>
      {!hideLabel && label && (
        <Input.Label htmlFor={id} required={required} display="block">
          {label}
        </Input.Label>
      )}
      {!hideLabel && description && (
        <Box className="widget-description" fz="xs" lh={1.2} mb={5}>
          <DescriptionFieldTemplate
            id={descriptionId(id)}
            description={description}
            schema={schema}
            uiSchema={uiSchema}
            registry={registry}
          />
        </Box>
      )}
      {children}
    </Box>
  );
}
