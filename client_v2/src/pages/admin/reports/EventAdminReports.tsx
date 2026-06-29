/**
 * Reports (SPEC §8.7). Browse the event's reports (selection is URL-addressable
 * via `?reportId`), view a report's rendered output, and create / edit / delete
 * report definitions. The template-variable bundle is assembled once and shared
 * by whichever report is rendered.
 */

import { Button, Card, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ApiReport } from 'api-types';
import { useReportTemplateVars } from 'hooks/useReportData';
import { useState } from 'react';
import { reportHooks } from 'store/entities';

import { RenderedReport } from './RenderedReport';
import { ReportEditForm } from './ReportEditForm';

const FROM = '/admin/organization/$organizationId/event/$eventId';

type Mode = 'view' | 'edit' | 'create';

export function EventAdminReports() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const { reportId } = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: reports } = reportHooks.useList({ event: eventId });
  const templateVars = useReportTemplateVars(eventId);
  const del = reportHooks.useDelete();
  const [mode, setMode] = useState<Mode>('view');

  const selected = reports?.find((r) => String(r.id) === reportId);

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

  const confirmDelete = (report: ApiReport) =>
    modals.openConfirmModal({
      title: 'Delete report',
      children: <Text>Delete “{report.title}”? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: report.id }, { onSuccess: () => select(undefined) }),
    });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Reports</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            select(undefined);
            setMode('create');
          }}
        >
          New report
        </Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
          <Stack gap="xs">
            {reports?.length ? (
              reports.map((report) => (
                <Button
                  key={report.id}
                  variant={selected?.id === report.id && mode !== 'create' ? 'light' : 'subtle'}
                  justify="flex-start"
                  onClick={() => select(report.id)}
                >
                  {report.title}
                </Button>
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
              <ReportEditForm eventId={eventId} onDone={(id) => select(id)} />
            </Card>
          )}

          {mode === 'edit' && selected && (
            <Card withBorder>
              <ReportEditForm eventId={eventId} report={selected} onDone={() => setMode('view')} />
            </Card>
          )}

          {mode === 'view' && selected && (
            <Stack>
              <Group justify="space-between">
                <Title order={3}>{selected.title}</Title>
                <Group gap="xs">
                  <Button variant="default" onClick={() => setMode('edit')}>
                    Edit
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => confirmDelete(selected)}
                  >
                    Delete
                  </Button>
                </Group>
              </Group>
              <RenderedReport report={selected} templateVars={templateVars} />
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
