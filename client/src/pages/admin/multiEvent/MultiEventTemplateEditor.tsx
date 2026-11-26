/**
 * The template editor for multi-event reports (SPEC §8.12, §9.6; §15 DR-181):
 * the event template editor's autocomplete, help and live preview, over the
 * organization's variables. The preview renders the unsaved text for every
 * included event, or the series the report is being looked at for.
 */

import type { ApiOrganizationReport } from 'api-types';
import { requestErrorMessage, TemplateEditorView } from 'components/TemplateEditor';
import { useMemo } from 'react';
import {
  useOrganizationTemplateDescription,
  useOrganizationTemplatePreview,
} from 'store/multiEvent';

interface MultiEventTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  organizationId: string | number;
  output: ApiOrganizationReport['output'];
  /** The series to preview for; every included event when omitted. */
  series?: string;
  /** Names the template in the expanded view. */
  title?: string;
}

export function MultiEventTemplateEditor({
  value,
  onChange,
  organizationId,
  output,
  series,
  title,
}: MultiEventTemplateEditorProps) {
  const description = useOrganizationTemplateDescription(organizationId);
  const request = useMemo(
    () => ({ template: value, output, ...(series ? { series } : {}) }),
    [value, output, series],
  );
  const preview = useOrganizationTemplatePreview(organizationId, request);

  return (
    <TemplateEditorView
      value={value}
      onChange={onChange}
      context="multi_event_report"
      output={output}
      description={description.data}
      preview={preview.data}
      rendering={preview.isFetching}
      previewError={preview.error ? requestErrorMessage(preview.error) : null}
      title={title}
    />
  );
}
