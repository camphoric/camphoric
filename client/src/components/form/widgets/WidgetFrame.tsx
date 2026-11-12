/**
 * Label and description chrome for the custom widgets (SPEC §9.1). Mantine's
 * inputs take a plain-string `description`, but this form's descriptions are
 * templated markdown rendered by DescriptionFieldTemplate, which produces block
 * content that can't go inside Mantine's `<p>`. So each custom widget renders
 * its control without a label and lets this frame supply the label and the
 * description between the label and the control — the same layout, sizing and
 * colours Mantine gives a text input.
 *
 * A description outside Mantine's input isn't one it links to the control, and
 * Mantine sets the control's `aria-describedby` itself (from its own error), over
 * any passed in. So each widget hands its Mantine input `linkToFrame`'s
 * `inputContainer`, which adds the frame's description to the ids Mantine's
 * wrapper describes the control by: a screen reader reads the description, and
 * the error as before. A group of checkboxes, which no `<label>` can name, is
 * named by the frame's label the same way (§15, DR-163).
 */

import './WidgetFrame.css';

import { Box, Input, InputWrapperContext } from '@mantine/core';
import { descriptionId, getTemplate, titleId, type WidgetProps } from '@rjsf/utils';
import { type ReactNode, use } from 'react';

/** A widget's description: `ui:description` wins over the schema's. */
export function widgetDescription(props: WidgetProps): string | undefined {
  const fromOptions = props.options.description;
  if (typeof fromOptions === 'string' && fromOptions) return fromOptions;
  return props.schema.description || undefined;
}

/** The description the frame shows: none when the label's hidden. */
function frameDescription(props: WidgetProps): string | undefined {
  return props.hideLabel ? undefined : widgetDescription(props);
}

/** Whether the frame shows the label. */
function showsLabel(props: WidgetProps): boolean {
  return !props.hideLabel && !!props.label;
}

interface FrameIds {
  /** The frame's description, added to what Mantine's wrapper describes the input by. */
  descriptionId?: string;
  /** The frame's label, naming a group when Mantine's wrapper has no label of its own. */
  labelId?: string;
}

/** Its control, inside Mantine's wrapper, with the frame's ids added to the wrapper's. */
function LinkedToFrame({ ids, children }: { ids: FrameIds; children: ReactNode }) {
  const wrapper = use(InputWrapperContext);
  const describedBy =
    [wrapper.describedBy, ids.descriptionId].filter(Boolean).join(' ') || undefined;
  return (
    <InputWrapperContext
      value={{ ...wrapper, describedBy, labelId: wrapper.labelId ?? ids.labelId }}
    >
      {children}
    </InputWrapperContext>
  );
}

/**
 * Mantine's `inputContainer` for a widget's control, linking it to the frame's
 * description (`aria-describedby`) and, for a group, label (`aria-labelledby`);
 * undefined when the frame shows neither.
 */
export function linkToFrame(props: WidgetProps): ((control: ReactNode) => ReactNode) | undefined {
  const ids: FrameIds = {
    descriptionId: frameDescription(props) ? descriptionId(props.id) : undefined,
    labelId: showsLabel(props) ? titleId(props.id) : undefined,
  };
  if (!ids.descriptionId && !ids.labelId) return undefined;
  return (control) => <LinkedToFrame ids={ids}>{control}</LinkedToFrame>;
}

export function WidgetFrame({ children, ...props }: WidgetProps & { children: ReactNode }) {
  const { id, label, required, schema, uiSchema, registry, options } = props;
  const description = frameDescription(props);
  const DescriptionFieldTemplate = getTemplate('DescriptionFieldTemplate', registry, options);

  return (
    <Box>
      {showsLabel(props) && (
        <Input.Label id={titleId(id)} htmlFor={id} required={required} display="block">
          {label}
        </Input.Label>
      )}
      {description && (
        <Box className="widget-description" fz="xs" lh={1.2} mb={5}>
          {/* eslint-disable-next-line react-hooks/static-components -- the registry's template, the same component every render */}
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
