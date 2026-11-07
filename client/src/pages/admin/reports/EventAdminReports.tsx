/**
 * Reports (SPEC §8.7). Browse the event's reports, grouped by category and
 * listed by title with their descriptions (selection is URL-addressable via
 * `?reportId`), view a report's rendered output, and create / edit / delete
 * report definitions. Legacy reports assemble the browser's variable bundle when
 * one is shown; reports with Camphoric variables don't need it. Leaving a
 * report form with unsaved changes — choosing another report, starting a new
 * one, Cancel, or leaving the page — asks first.
 */

import { Button, Card, Grid, Group, NavLink, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiReport } from 'api-types';
import { confirmDelete } from 'components/ConfirmDelete';
import { BeingEdited, RecordDeleted } from 'components/EditLease';
import { CanEdit } from 'hooks/permissions';
import { useKeptRecord } from 'hooks/useKeptRecord';
import { useUnsavedChanges } from 'hooks/useUnsavedChanges';
import { useMemo, useState } from 'react';
import { reportHooks } from 'store/entities';

import { RenderedReport } from './RenderedReport';
import { ReportEditForm } from './ReportEditForm';
import { groupReports, reportCategories } from './reportGroups';

const FROM = '/admin/organization/$organizationId/event/$eventId';

type Mode = 'view' | 'edit' | 'create';

export function EventAdminReports() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const { reportId } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: reports } = reportHooks.useList({ event: eventId });
  const groups = useMemo(() => groupReports(reports ?? []), [reports]);
  const categories = groups.map((group) => group.category).filter(Boolean);
  const del = reportHooks.useDelete();
  const [mode, setMode] = useState<Mode>('view');
  const [formDirty, setFormDirty] = useState(false);
  const { confirmDiscard, release } = useUnsavedChanges(mode !== 'view' && formDirty);

  // Kept open while being edited if someone else deletes it meanwhile, so no
  // unsaved edit vanishes (§9.8).
  const found = reports?.find((r) => String(r.id) === reportId);
  const kept = useKeptRecord(mode === 'edit' ? reportId : undefined, found);
  const selected = found ?? kept.record;
  // An edited report's own category isn't one to snap it to, so its
  // capitals can be changed (§8.7).
  const otherCategories = useMemo(
    () => reportCategories((reports ?? []).filter((r) => r.id !== selected?.id)),
    [reports, selected?.id],
  );
  const helpHref = `/admin/organization/${organizationId}/event/${eventId}/template-help?context=report`;

  // Stay on the reports route and only update the URL-addressable selection;
  // navigating with just `search` would resolve to the parent layout, which
  // redirects back to Home.
  const select = (id?: number) => {
    setMode('view');
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/reports',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, reportId: id ? String(id) : undefined }),
    });
  };

  const confirmDeleteReport = (report: ApiReport) =>
    confirmDelete({
      path: 'reports',
      id: report.id,
      title: 'Delete report',
      message: <>Delete “{report.title}”?</>,
      onConfirm: () =>
        del.mutate(
          { id: report.id, version: report.version },
          { onSuccess: () => select(undefined) },
        ),
    });

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

      <Grid>
        <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
          <Stack gap="md">
            {groups.length ? (
              groups.map((group) => (
                <Stack
                  key={group.category}
                  gap={2}
                  role="group"
                  aria-label={group.category || 'Uncategorised'}
                >
                  {/* Headings only once some report has a category */}
                  {categories.length > 0 && (
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="sm">
                      {group.category || 'Uncategorised'}
                    </Text>
                  )}
                  {group.reports.map((report) => (
                    <NavLink
                      key={report.id}
                      component="button"
                      type="button"
                      label={report.title}
                      description={report.description || undefined}
                      active={selected?.id === report.id && mode !== 'create'}
                      variant="light"
                      onClick={() => confirmDiscard(() => select(report.id))}
                      rightSection={<BeingEdited model="report" id={report.id} />}
                    />
                  ))}
                </Stack>
              ))
            ) : (
              <Text c="dimmed" size="sm">
                No reports yet.
              </Text>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 8, md: 9 }}>
          {mode === 'create' && (
            <Card withBorder>
              <ReportEditForm
                eventId={eventId}
                categories={categories}
                helpHref={helpHref}
                onDirtyChange={setFormDirty}
                onSaved={(id) => {
                  release();
                  select(id);
                }}
                onCancel={() => confirmDiscard(() => select(undefined))}
              />
            </Card>
          )}

          {mode === 'edit' && selected && (
            <Card withBorder>
              {kept.deleted && <RecordDeleted label="report" />}
              <ReportEditForm
                eventId={eventId}
                report={selected}
                categories={otherCategories}
                helpHref={helpHref}
                onDirtyChange={setFormDirty}
                onSaved={() => setMode('view')}
                onCancel={() => confirmDiscard(() => setMode('view'))}
              />
            </Card>
          )}

          {mode === 'view' && selected && (
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
              <RenderedReport report={selected} eventId={eventId} />
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
