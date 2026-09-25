/**
 * Template Help (SPEC §9.3): the variables a kind of template receives, the
 * filters/tests/tags, and the guides, with a search over the first two. Used
 * beside the template editor (where entries can be inserted) and on the
 * standalone help page (which keeps the tab, topic and search in the URL).
 * Each piece of state is controlled when its props are given.
 */

import { Stack, Tabs, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { TemplateContextName, TemplateDescription } from 'api-types';
import { InlineLoading } from 'components/Loading';
import { useState } from 'react';

import { DEFAULT_TOPIC } from './guides';
import { TemplateGuide } from './TemplateGuide';
import { type InsertHandler, TemplateReference } from './TemplateReference';
import { TemplateSyntaxReference } from './TemplateSyntaxReference';

export type HelpTab = 'variables' | 'syntax' | 'guide';

export const HELP_TABS: HelpTab[] = ['variables', 'syntax', 'guide'];

interface TemplateHelpPanelProps {
  description?: TemplateDescription;
  context: TemplateContextName;
  onInsert?: InsertHandler;
  tab?: HelpTab;
  onTabChange?: (tab: HelpTab) => void;
  topic?: string;
  onTopicChange?: (topic: string) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
}

function useControllable<T>(
  value: T | undefined,
  onChange: ((next: T) => void) | undefined,
  initial: T,
) {
  const [own, setOwn] = useState(initial);
  return [value ?? own, onChange ?? setOwn] as const;
}

export function TemplateHelpPanel({
  description,
  context,
  onInsert,
  tab: tabProp,
  onTabChange,
  topic: topicProp,
  onTopicChange,
  query: queryProp,
  onQueryChange,
}: TemplateHelpPanelProps) {
  const [tab, setTab] = useControllable<HelpTab>(tabProp, onTabChange, 'variables');
  const [topic, setTopic] = useControllable(topicProp, onTopicChange, DEFAULT_TOPIC);
  const [query, setQuery] = useControllable(queryProp, onQueryChange, '');

  const search = (
    <TextInput
      aria-label="Search help"
      placeholder="Search names and descriptions"
      leftSection={<IconSearch size={16} />}
      value={query}
      onChange={(e) => setQuery(e.currentTarget.value)}
    />
  );

  return (
    <Tabs value={tab} onChange={(value) => value && setTab(value as HelpTab)} keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="variables">Variables</Tabs.Tab>
        <Tabs.Tab value="syntax">Filters, tests and tags</Tabs.Tab>
        <Tabs.Tab value="guide">Guides</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="variables" pt="md">
        <Stack>
          {search}
          {description ? (
            <TemplateReference
              description={description}
              context={context}
              query={query}
              onInsert={onInsert}
            />
          ) : (
            <InlineLoading message="Loading variables…" />
          )}
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="syntax" pt="md">
        <Stack>
          {search}
          {description ? (
            <TemplateSyntaxReference description={description} query={query} onInsert={onInsert} />
          ) : (
            <InlineLoading message="Loading…" />
          )}
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="guide" pt="md">
        <TemplateGuide topic={topic} onTopicChange={setTopic} />
      </Tabs.Panel>
    </Tabs>
  );
}
