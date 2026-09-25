/**
 * The Template Help page (SPEC §4, §9.3): the full reference and guides for
 * one kind of template, chosen here, plus a download of that kind's sample
 * variables rendered from the event's real data. The context, tab, guide
 * topic and search are URL-addressable (`?context`, `?helpTab`, `?topic`,
 * `?q`), so a page can be linked to directly.
 */

import { Button, Group, Select, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload } from '@tabler/icons-react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { TemplateContextName } from 'api-types';
import { InlineLoading } from 'components/Loading';
import {
  DEFAULT_TOPIC,
  HELP_TABS,
  type HelpTab,
  sampleVariablesTemplate,
  TemplateHelpPanel,
} from 'components/TemplateHelp';
import { useRenderTemplateOnce, useTemplateDescription } from 'store/templates';
import { downloadTextFile } from 'utils/download';

const FROM = '/admin/organization/$organizationId/event/$eventId';
const DEFAULT_CONTEXT: TemplateContextName = 'report';

export function EventAdminTemplateHelp() {
  const { organizationId, eventId } = useParams({ from: FROM });
  const search = useSearch({ from: FROM });
  const navigate = useNavigate();
  const { data: description, isLoading } = useTemplateDescription(eventId);
  const render = useRenderTemplateOnce(eventId);

  const context = (
    description && search.context && search.context in description.contexts
      ? search.context
      : DEFAULT_CONTEXT
  ) as TemplateContextName;
  const tab = HELP_TABS.includes(search.helpTab as HelpTab)
    ? (search.helpTab as HelpTab)
    : 'variables';

  // Update one search param, dropping it when it's back to its default.
  const setParam = (key: string, value: string, fallback: string) =>
    void navigate({
      to: '/admin/organization/$organizationId/event/$eventId/template-help',
      params: { organizationId, eventId },
      search: (prev) => ({ ...prev, [key]: value === fallback ? undefined : value || undefined }),
      replace: true,
    });

  const downloadSample = () => {
    if (!description) return;
    render.mutate(
      { context, output: 'txt', template: sampleVariablesTemplate(description, context) },
      {
        onSuccess: (result) => {
          const error = result.diagnostics.find((d) => d.severity === 'error');
          if (error || result.truncated) {
            notifications.show({
              color: 'red',
              title: 'Couldn’t build the sample',
              message: error?.message ?? 'The sample is too large.',
            });
            return;
          }
          downloadTextFile(result.output, 'application/json', `${context}-sample-variables.json`);
          if (result.sample) {
            notifications.show({
              message: `Sample variables for ${result.sample.label} downloaded.`,
            });
          }
        },
        onError: (error) =>
          notifications.show({
            color: 'red',
            title: 'Couldn’t build the sample',
            message: error.message,
          }),
      },
    );
  };

  if (isLoading || !description) return <InlineLoading message="Loading template help…" />;

  const contextDescription = description.contexts[context];

  return (
    <Stack maw={960}>
      <Title order={2}>Template help</Title>
      <Group align="flex-end" justify="space-between">
        <Select
          label="Kind of template"
          data={Object.entries(description.contexts).map(([value, c]) => ({
            value,
            label: c.title,
          }))}
          value={context}
          onChange={(value) => value && setParam('context', value, DEFAULT_CONTEXT)}
          allowDeselect={false}
          w={320}
        />
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          loading={render.isPending}
          onClick={downloadSample}
        >
          Download sample variables
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        {contextDescription.doc} The sample download shows these variables with this event’s data
        (lists cut to their first few items).
      </Text>
      <TemplateHelpPanel
        description={description}
        context={context}
        tab={tab}
        onTabChange={(value) => setParam('helpTab', value, 'variables')}
        topic={search.topic ?? DEFAULT_TOPIC}
        onTopicChange={(value) => setParam('topic', value, DEFAULT_TOPIC)}
        query={search.q ?? ''}
        onQueryChange={(value) => setParam('q', value, '')}
      />
    </Stack>
  );
}
