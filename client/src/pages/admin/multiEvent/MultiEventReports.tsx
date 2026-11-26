/**
 * Multi-event reports' Reports section (SPEC §8.12; §15 DR-181): the
 * organization's report templates, grouped by category as an event's are
 * (§8.7), with the selected one (`?reportId`) rendered for every included
 * event or one series (`?series`), and created, edited and deleted by those
 * who can change data. Leaving a form with unsaved changes asks first.
 */

import { Alert, Button, Card, Grid, Group, Select, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiOrganizationReport } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { RecordDeleted } from 'components/EditLease';
import { InlineLoading } from 'components/Loading';
import { requestErrorMessage } from 'components/TemplateEditor';
import { CanEdit } from 'hooks/permissions';
import { useKeptRecord } from 'hooks/useKeptRecord';
import { useUnsavedChanges } from 'hooks/useUnsavedChanges';
import { useMemo, useState } from 'react';
import { organizationHooks, organizationReportHooks } from 'store/entities';
import { useMultiEventStats, useRenderedOrganizationReport } from 'store/multiEvent';

import { ReportOutput } from '../reports/RenderedReport';
import { groupReports } from '../reports/reportGroups';
import { ReportList } from '../reports/ReportList';
import { OrganizationReportForm } from './OrganizationReportForm';

const FROM = '/admin/organization/$organizationId/multi-event';

type Mode = 'view' | 'edit' | 'create';

function RenderedOrganizationReport({
  report,
  series,
  name,
}: {
  report: ApiOrganizationReport;
  series?: string;
  name: string | undefined;
}) {
  const rendered = useRenderedOrganizationReport(report, series);
  if (rendered.isError) {
    return (
      <Alert color="red" variant="light" title="Couldn’t render this report">
        {requestErrorMessage(rendered.error)}
      </Alert>
    );
  }
  if (!rendered.data) return <InlineLoading />;
  return <ReportOutput report={report} data={rendered.data} eventName={name} />;
}

export function MultiEventReports() {
  const { organizationId } = useParams({ from: FROM });
  const { reportId, series } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: organization } = organizationHooks.useById(organizationId);
  const { data: reports } = organizationReportHooks.useList({ organization: organizationId });
  const { data: stats, isError: statsFailed } = useMultiEventStats(organizationId, '');
  const groups = useMemo(() => groupReports(reports ?? []), [reports]);
  const categories = groups.map((group) => group.category).filter(Boolean);
  const del = organizationReportHooks.useDelete();
  const [mode, setMode] = useState<Mode>('view');
  const [formDirty, setFormDirty] = useState(false);
  const { confirmDiscard, release } = useUnsavedChanges(mode !== 'view' && formDirty);

  const found = reports?.find((r) => String(r.id) === reportId);
  const kept = useKeptRecord(mode === 'edit' ? reportId : undefined, found);
  const selected = found ?? kept.record;
  const seriesNames = stats?.series ?? [];
  // A series in the URL is checked against the organization's before anything
  // renders, so a report isn't rendered for every event first. Without the
  // list, the URL's is taken as it is (an unknown one renders nothing).
  const seriesKnown = !series || !!stats || statsFailed;
  const chosenSeries = series && (!stats || seriesNames.includes(series)) ? series : undefined;

  const go = (search: { reportId?: string; series?: string }) =>
    void navigate({
      to: '/admin/organization/$organizationId/multi-event/reports',
      params: { organizationId },
      search: (prev) => ({ ...prev, ...search }),
    });
  const select = (id?: number) => {
    setMode('view');
    go({ reportId: id ? String(id) : undefined });
  };

  const confirmDeleteReport = (report: ApiOrganizationReport) =>
    confirmDelete({
      path: 'organization-reports',
      id: report.id,
      title: 'Delete report',
      message: <>Delete “{report.title}”?</>,
      onConfirm: () =>
        del.mutate(
          { id: report.id, version: report.version },
          { onSuccess: () => select(undefined) },
        ),
    });

  const fileName = [organization?.name, chosenSeries].filter(Boolean).join(' ') || undefined;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Reports</Title>
        <CanEdit>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              confirmDiscard(() => {
                select(undefined);
                setMode('create');
              })
            }
          >
            New report
          </Button>
        </CanEdit>
      </Group>
      <Text size="sm" c="dimmed" maw={760}>
        Reports written across the included events and the people linked across them. Each renders
        for every included event, or for one series.
      </Text>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
          {reports && reports.length === 0 && mode !== 'create' ? (
            <Text size="sm" c="dimmed">
              No reports yet.
            </Text>
          ) : (
            <ReportList
              groups={groups}
              selectedId={mode !== 'create' ? selected?.id : undefined}
              onSelect={(report) => confirmDiscard(() => select(report.id))}
            />
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 8, md: 9 }}>
          {!seriesKnown && <InlineLoading />}
          {seriesKnown && mode === 'create' && (
            <Card withBorder>
              <OrganizationReportForm
                organizationId={organizationId}
                categories={categories}
                series={chosenSeries}
                onDirtyChange={setFormDirty}
                onSaved={(id) => {
                  release();
                  select(id);
                }}
                onCancel={() => confirmDiscard(() => select(undefined))}
              />
            </Card>
          )}

          {seriesKnown && mode === 'edit' && selected && (
            <Card withBorder>
              {kept.deleted && <RecordDeleted label="report" />}
              <OrganizationReportForm
                organizationId={organizationId}
                report={selected}
                categories={categories}
                series={chosenSeries}
                onDirtyChange={setFormDirty}
                onSaved={() => setMode('view')}
                onCancel={() => confirmDiscard(() => setMode('view'))}
              />
            </Card>
          )}

          {seriesKnown && mode === 'view' && selected && (
            <Stack>
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Title order={3}>{selected.title}</Title>
                  {(selected.category || selected.description) && (
                    <Text size="sm" c="dimmed">
                      {[selected.category.trim(), selected.description].filter(Boolean).join(' — ')}
                    </Text>
                  )}
                </Stack>
                <CanEdit>
                  <Group gap="xs">
                    <Button variant="default" onClick={() => setMode('edit')}>
                      Edit
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => confirmDeleteReport(selected)}
                    >
                      Delete
                    </Button>
                  </Group>
                </CanEdit>
              </Group>
              {seriesNames.length > 0 && (
                <Select
                  label="Series"
                  data={[
                    { value: '', label: 'All included events' },
                    ...seriesNames.map((name) => ({ value: name, label: name })),
                  ]}
                  value={chosenSeries ?? ''}
                  onChange={(value) => go({ series: value || undefined })}
                  allowDeselect={false}
                  maw={320}
                />
              )}
              <RenderedOrganizationReport report={selected} series={chosenSeries} name={fileName} />
            </Stack>
          )}

          {mode === 'view' && !selected && (
            <Text c="dimmed">Select a report, or create a new one.</Text>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
