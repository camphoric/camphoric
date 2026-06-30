/**
 * Create or edit a report definition (SPEC §8.7): title, output format, the
 * template body (Monaco, with the language matching the format), and the
 * variables JSON schema. Title must be non-empty and the schema must parse
 * before saving. Saving an existing report PATCHes it; a new one POSTs.
 */

import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiReport, Hash, ReportOutputType } from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import { useMemo, useState } from 'react';
import { reportHooks } from 'store/entities';

const OUTPUT_OPTIONS: { value: ReportOutputType; label: string }[] = [
  { value: 'csv', label: 'CSV (Jinja2 → table)' },
  { value: 'md', label: 'Markdown (Jinja2)' },
  { value: 'txt', label: 'Text (Jinja2)' },
  { value: 'hbs', label: 'Handlebars (client-side)' },
];

/** Monaco language per output format; the Jinja2 formats have no dedicated mode. */
const TEMPLATE_LANGUAGE: Record<ReportOutputType, string> = {
  hbs: 'handlebars',
  md: 'markdown',
  csv: 'plaintext',
  txt: 'plaintext',
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
  const [output, setOutput] = useState<ReportOutputType>(report?.output ?? 'csv');
  const [template, setTemplate] = useState(report?.template ?? '');
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(report?.variables_schema ?? {}, null, 2),
  );

  const schemaError = useMemo(() => {
    try {
      JSON.parse(schemaText);
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  }, [schemaText]);

  const titleError = title.trim() ? null : 'Title is required';
  const canSave = !titleError && !schemaError && !create.isPending && !update.isPending;

  const save = () => {
    const variables_schema = JSON.parse(schemaText) as Hash;
    const onSuccess = (saved: ApiReport) => {
      notifications.show({ color: 'green', message: 'Report saved' });
      onDone(saved.id);
    };

    if (report) {
      update.mutate({ id: report.id, title, output, template, variables_schema }, { onSuccess });
    } else {
      create.mutate({ event: eventId, title, output, template, variables_schema }, { onSuccess });
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
        label="Output format"
        data={OUTPUT_OPTIONS}
        value={output}
        onChange={(value) => value && setOutput(value as ReportOutputType)}
        allowDeselect={false}
      />
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Template
        </Text>
        <JsonEditor
          value={template}
          onChange={setTemplate}
          language={TEMPLATE_LANGUAGE[output]}
          height={320}
        />
      </Stack>
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
