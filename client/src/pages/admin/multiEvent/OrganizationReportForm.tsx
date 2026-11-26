/**
 * Create or edit a multi-event report (SPEC §8.12; §15 DR-181): title,
 * category (one of the organization's or a new one), description, output
 * format, and the Jinja template, edited with the organization's variables and
 * a live preview. Title must be non-empty before saving. Saving an existing
 * report PATCHes it from the version the form opened at, so a change someone
 * else saved meanwhile is never overwritten unseen (§9.8, DR-109); a new one
 * POSTs.
 *
 * The page owns leaving: it's told whether anything differs from the saved
 * report (`onDirtyChange`), and Cancel goes through `onCancel`.
 */

import { Autocomplete, Button, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiOrganizationReport } from 'api-types';
import { FormActions } from 'components/FormActions';
import { CanEdit, ReadOnlyFieldset } from 'hooks/permissions';
import { useConflictAwareSave, useLatestWhileUnchanged } from 'hooks/useEditableRecord';
import { useEffect, useState } from 'react';
import { organizationReportHooks } from 'store/entities';

import { categoryToSave } from '../reports/reportGroups';
import { MultiEventTemplateEditor } from './MultiEventTemplateEditor';

type Output = ApiOrganizationReport['output'];

const OUTPUT_OPTIONS: { value: Output; label: string }[] = [
  { value: 'csv', label: 'CSV (table)' },
  { value: 'md', label: 'Markdown' },
  { value: 'txt', label: 'Text' },
  { value: 'html', label: 'HTML' },
];

type Fields = Pick<
  ApiOrganizationReport,
  'title' | 'category' | 'description' | 'output' | 'template'
>;

const fieldsOf = (report?: ApiOrganizationReport): Fields => ({
  title: report?.title ?? '',
  category: report?.category ?? '',
  description: report?.description ?? '',
  output: report?.output ?? 'csv',
  template: report?.template ?? '',
});

interface OrganizationReportFormProps {
  organizationId: string;
  /** Omitted when creating a new report. */
  report?: ApiOrganizationReport;
  /** The organization's report categories, offered as choices. */
  categories?: string[];
  /** The series the preview renders for; every included event when omitted. */
  series?: string;
  onSaved: (reportId: number) => void;
  onCancel: () => void;
  /** Whether the form differs from the saved report (a new one: from blank). */
  onDirtyChange?: (dirty: boolean) => void;
}

export function OrganizationReportForm({
  organizationId,
  report: latest,
  categories = [],
  series,
  onSaved,
  onCancel,
  onDirtyChange,
}: OrganizationReportFormProps) {
  const create = organizationReportHooks.useCreate();
  const update = organizationReportHooks.useUpdate({ handlesVersionConflict: true });
  const [initial, setInitial] = useState(() => fieldsOf(latest));
  const [fields, setFields] = useState(initial);
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const dirty = (Object.keys(initial) as (keyof Fields)[]).some(
    (key) => fields[key] !== initial[key],
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // The version shown: a newer one shows while nothing here is unsaved.
  const [report, showVersion] = useLatestWhileUnchanged<ApiOrganizationReport>(
    latest,
    (): boolean => !dirty,
    (record) => {
      setFields(fieldsOf(record));
      setInitial(fieldsOf(record));
    },
  );
  const saveReport = useConflictAwareSave(
    report,
    { toForm: fieldsOf, saveRecord: update.mutateAsync, label: 'report' },
    true,
  );

  const titleError = fields.title.trim() ? null : 'Title is required';
  const canSave = !titleError && !create.isPending && !update.isPending;

  const save = async () => {
    const values = {
      ...fields,
      category: categoryToSave(fields.category, initial.category, categories),
    };
    const onSuccess = (saved: ApiOrganizationReport) => {
      notifications.show({ color: 'green', message: 'Report saved' });
      onSaved(saved.id);
    };
    if (report) {
      const outcome = await saveReport(values, setFields);
      if (outcome?.saved) onSuccess(outcome.saved);
      if (outcome?.discarded) showVersion(outcome.discarded);
    } else {
      create.mutate({ organization: organizationId, ...values }, { onSuccess });
    }
  };

  return (
    <Stack>
      <Text fw={600}>{report ? 'Edit report' : 'New report'}</Text>
      <ReadOnlyFieldset>
        <Stack>
          <TextInput
            label="Title"
            value={fields.title}
            onChange={(e) => set('title', e.currentTarget.value)}
            error={fields.title ? titleError : null}
          />
          <Autocomplete
            label="Category"
            description="Groups related reports in the list. Pick one of the organization’s, or type a new one."
            placeholder="None"
            data={categories}
            value={fields.category}
            onChange={(value) => set('category', value)}
            maxLength={100}
          />
          <Textarea
            label="Description"
            description="What the report shows and who it’s for."
            value={fields.description}
            onChange={(e) => set('description', e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Select
            label="Output format"
            data={OUTPUT_OPTIONS}
            value={fields.output}
            onChange={(value) => value && set('output', value)}
            allowDeselect={false}
          />
        </Stack>
      </ReadOnlyFieldset>
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Template
        </Text>
        <MultiEventTemplateEditor
          value={fields.template}
          onChange={(value) => set('template', value)}
          organizationId={organizationId}
          output={fields.output}
          series={series}
          title={fields.title.trim() || 'Report template'}
        />
      </Stack>
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
    </Stack>
  );
}
