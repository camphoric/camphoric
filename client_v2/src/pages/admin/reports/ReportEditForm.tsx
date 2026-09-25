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
 */

import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiReport, Hash, ReportOutputType, ReportVariablesSource } from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import { TemplateEditor } from 'components/TemplateEditor';
import { useMemo, useState } from 'react';
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

interface ReportEditFormProps {
  eventId: string;
  /** Omitted when creating a new report. */
  report?: ApiReport;
  onDone: (reportId?: number) => void;
}

export function ReportEditForm({ eventId, report, onDone }: ReportEditFormProps) {
  const create = reportHooks.useCreate();
  const update = reportHooks.useUpdate();

  const [title, setTitle] = useState(report?.title ?? '');
  const [source, setSource] = useState<ReportVariablesSource>(report?.variables_source ?? 'server');
  const [output, setOutput] = useState<ReportOutputType>(report?.output ?? 'csv');
  const [template, setTemplate] = useState(report?.template ?? '');
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(report?.variables_schema ?? {}, null, 2),
  );

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

  const save = () => {
    const variables_schema = isServer
      ? (report?.variables_schema ?? {})
      : (JSON.parse(schemaText) as Hash);
    const fields = { title, output, template, variables_schema, variables_source: source };
    const onSuccess = (saved: ApiReport) => {
      notifications.show({ color: 'green', message: 'Report saved' });
      onDone(saved.id);
    };

    if (report) {
      update.mutate({ id: report.id, ...fields }, { onSuccess });
    } else {
      create.mutate({ event: eventId, ...fields }, { onSuccess });
    }
  };

  return (
    <Stack>
      <Text fw={600}>{report ? 'Edit report' : 'New report'}</Text>
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
      <Group>
        <Button onClick={save} disabled={!canSave} loading={create.isPending || update.isPending}>
          Save
        </Button>
        <Button variant="default" onClick={() => onDone(report?.id)}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
