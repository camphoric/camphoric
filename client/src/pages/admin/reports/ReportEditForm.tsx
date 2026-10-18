/**
 * Create or edit a report definition (SPEC §8.7): title, where its variables
 * come from, output format, and the template. Title must be non-empty before
 * saving. Saving an existing report PATCHes it; a new one POSTs.
 *
 * - **Camphoric variables** (`server`, the default for new reports): the
 *   template is edited in the template editor, with autocomplete and a live
 *   preview (§9.6).
 * - **Browser bundle** (`client`, legacy): the template plus a variables JSON
 *   schema, which must parse. Handlebars reports are always legacy.
 *
 * The page owns leaving: it's told whether anything differs from the saved
 * report (`onDirtyChange`), and Cancel goes through `onCancel`.
 */

import { Alert, Button, Select, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiReport, Hash, ReportOutputType, ReportVariablesSource } from 'api-types';
import { EditLeaseNotice } from 'components/EditLease';
import { FormActions } from 'components/FormActions';
import { JsonEditor } from 'components/JsonEditor';
import { TemplateEditor } from 'components/TemplateEditor';
import { CanEdit, ReadOnlyFieldset, ViewOnly } from 'hooks/permissions';
import { useConflictAwareSave, useLatestWhileUnchanged } from 'hooks/useEditableRecord';
import { useEditLease } from 'hooks/useEditLease';
import { useEffect, useMemo, useState } from 'react';
import { reportHooks } from 'store/entities';

const SOURCE_OPTIONS: { value: ReportVariablesSource; label: string }[] = [
  { value: 'server', label: 'Camphoric variables (rendered on the server)' },
  { value: 'client', label: 'Browser bundle (legacy)' },
];

const OUTPUT_OPTIONS: { value: ReportOutputType; label: string; legacyOnly?: boolean }[] = [
  { value: 'csv', label: 'CSV (Jinja → table)' },
  { value: 'md', label: 'Markdown (Jinja)' },
  { value: 'txt', label: 'Text (Jinja)' },
  { value: 'html', label: 'HTML (Jinja)' },
  { value: 'hbs', label: 'Handlebars (client-side)', legacyOnly: true },
];

/** Monaco language per output format for legacy templates. */
const LEGACY_TEMPLATE_LANGUAGE: Record<ReportOutputType, string> = {
  hbs: 'handlebars',
  md: 'markdown',
  csv: 'plaintext',
  txt: 'plaintext',
  html: 'html',
};

type ReportFields = Pick<
  ApiReport,
  'title' | 'output' | 'template' | 'variables_schema' | 'variables_source'
>;

interface ReportEditFormProps {
  eventId: string;
  /** Omitted when creating a new report. */
  report?: ApiReport;
  /** The Template Help page, linked from the editor's help. */
  helpHref?: string;
  onSaved: (reportId: number) => void;
  onCancel: () => void;
  /** Whether the form differs from the saved report (a new one: from blank). */
  onDirtyChange?: (dirty: boolean) => void;
}

const reportFields = (record: ApiReport): ReportFields => ({
  title: record.title,
  output: record.output,
  template: record.template,
  variables_schema: record.variables_schema,
  variables_source: record.variables_source,
});

interface Starting {
  title: string;
  source: ReportVariablesSource;
  output: ReportOutputType;
  template: string;
  schemaText: string;
}

/** What unsaved changes are measured from. */
const startingFrom = (fields?: ReportFields): Starting => ({
  title: fields?.title ?? '',
  source: fields?.variables_source ?? 'server',
  output: fields?.output ?? 'csv',
  template: fields?.template ?? '',
  schemaText: JSON.stringify(fields?.variables_schema ?? {}, null, 2),
});

export function ReportEditForm({
  eventId,
  report: latest,
  helpHref,
  onSaved,
  onCancel,
  onDirtyChange,
}: ReportEditFormProps) {
  const create = reportHooks.useCreate();
  const update = reportHooks.useUpdate({ handlesVersionConflict: true });
  const [initial, setInitial] = useState(() => startingFrom(latest && reportFields(latest)));
  const [title, setTitle] = useState(initial.title);
  const [source, setSource] = useState<ReportVariablesSource>(initial.source);
  const [output, setOutput] = useState<ReportOutputType>(initial.output);
  const [template, setTemplate] = useState(initial.template);
  const [schemaText, setSchemaText] = useState(initial.schemaText);

  const dirty =
    title !== initial.title ||
    source !== initial.source ||
    output !== initial.output ||
    template !== initial.template ||
    schemaText !== initial.schemaText;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const show = (fields: ReportFields) => {
    setTitle(fields.title);
    setOutput(fields.output);
    setTemplate(fields.template);
    setSource(fields.variables_source);
    setSchemaText(JSON.stringify(fields.variables_schema ?? {}, null, 2));
  };

  // The version shown: a newer one shows while nothing here is unsaved.
  const [report, showVersion] = useLatestWhileUnchanged<ApiReport>(
    latest,
    (): boolean => !dirty,
    (record) => {
      show(reportFields(record));
      setInitial(startingFrom(reportFields(record)));
    },
  );
  const saveReport = useConflictAwareSave(
    report,
    {
      toForm: reportFields,
      saveRecord: update.mutateAsync,
      label: 'report',
      fieldLabels: { variables_schema: 'Variables schema', variables_source: 'Variables from' },
    },
    true,
  );

  // Who else is editing it (§9.8): held while there are unsaved changes.
  const lease = useEditLease(report ? 'report' : undefined, report?.id ?? 0, dirty);

  const isServer = source === 'server';

  const schemaError = useMemo(() => {
    if (isServer) return null;
    try {
      JSON.parse(schemaText);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, [isServer, schemaText]);

  const titleError = title.trim() ? null : 'Title is required';
  const canSave = !titleError && !schemaError && !create.isPending && !update.isPending;

  const applySource = (next: ReportVariablesSource) => {
    setSource(next);
    if (next === 'server' && output === 'hbs') setOutput('csv');
  };

  // A saved template was written for its variables; switching needs a rewrite.
  const changeSource = (next: ReportVariablesSource) => {
    if (next === source) return;
    if (!report || !template.trim() || next === report.variables_source) {
      applySource(next);
      return;
    }
    modals.openConfirmModal({
      title: 'Change where variables come from?',
      children: (
        <Text size="sm">
          The two kinds of report use different variables, so this template will need rewriting
          before it renders. The text isn’t changed.
        </Text>
      ),
      labels: { confirm: 'Change', cancel: 'Cancel' },
      onConfirm: () => applySource(next),
    });
  };

  const save = async () => {
    const variables_schema = isServer
      ? (report?.variables_schema ?? {})
      : (JSON.parse(schemaText) as Hash);
    const fields = { title, output, template, variables_schema, variables_source: source };
    const onSuccess = (saved: ApiReport) => {
      notifications.show({ color: 'green', message: 'Report saved' });
      onSaved(saved.id);
    };

    if (report) {
      // From the version the form opened at, so a change someone else saved
      // meanwhile is never overwritten unseen (§9.8, DR-109).
      const outcome = await saveReport(fields, show);
      if (outcome?.saved) onSuccess(outcome.saved);
      if (outcome?.discarded) showVersion(outcome.discarded);
    } else {
      create.mutate({ event: eventId, ...fields }, { onSuccess });
    }
  };

  return (
    <Stack>
      <Text fw={600}>{report ? 'Edit report' : 'New report'}</Text>
      <EditLeaseNotice label="report" lease={lease} />
      <ViewOnly when={lease.viewOnly}>
        <ReadOnlyFieldset>
          <Stack>
            <TextInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              error={title ? titleError : null}
            />
            <Select
              label="Variables"
              description={
                isServer
                  ? 'The server builds the event’s data; autocomplete and a live preview help write the template.'
                  : 'The browser assembles and uploads the event’s data for each render.'
              }
              data={SOURCE_OPTIONS}
              value={source}
              onChange={(value) => value && changeSource(value as ReportVariablesSource)}
              allowDeselect={false}
            />
            <Select
              label="Output format"
              data={OUTPUT_OPTIONS.filter((option) => !isServer || !option.legacyOnly)}
              value={output}
              onChange={(value) => value && setOutput(value as ReportOutputType)}
              allowDeselect={false}
            />
          </Stack>
        </ReadOnlyFieldset>
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Template
          </Text>
          {isServer ? (
            <TemplateEditor
              value={template}
              onChange={setTemplate}
              eventId={eventId}
              context="report"
              output={output === 'hbs' ? 'md' : output}
              helpHref={helpHref}
              title={title.trim() || 'Report template'}
            />
          ) : (
            <JsonEditor
              value={template}
              onChange={setTemplate}
              language={LEGACY_TEMPLATE_LANGUAGE[output]}
              height={320}
            />
          )}
        </Stack>
        {!isServer && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Variables schema
            </Text>
            <JsonEditor value={schemaText} onChange={setSchemaText} height={200} />
            {schemaError ? (
              <Alert color="red" variant="light" title="Invalid JSON">
                {schemaError}
              </Alert>
            ) : null}
          </Stack>
        )}
        <FormActions dirty={dirty} justify="flex-start">
          <CanEdit>
            <Button
              onClick={() => void save()}
              disabled={!canSave}
              loading={create.isPending || update.isPending}
            >
              Save
            </Button>
          </CanEdit>
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
        </FormActions>
      </ViewOnly>
    </Stack>
  );
}
