/**
 * Editing an organization's contract draft (SPEC §8.1; §15 DR-145): its sections
 * in order, each a title and a Markdown body. Sections can be added, removed,
 * edited and moved; the privacy policy section can be retitled, edited and
 * moved, but not removed. Saving sends the whole list in its new order;
 * publishing (once saved) makes it the next version, which everyone must then
 * agree to — signing everyone else out and disconnecting every app (DR-151).
 */

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from '@tabler/icons-react';
import type { ApiContractSection } from 'api-types';
import { ContractText } from 'components/Contract';
import { FormActions } from 'components/FormActions';
import { useState } from 'react';

interface ContractDraftEditorProps {
  organizationName: string;
  /** The draft's sections as saved. */
  saved: ApiContractSection[];
  /** The number the draft will have once published. */
  nextNumber: number;
  saving?: boolean;
  publishing?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSave: (sections: ApiContractSection[]) => void;
  onPublish: () => void;
  onDelete: () => void;
}

/** Why the draft can't be published yet, or null. */
export function publishProblem(sections: ApiContractSection[]): string | null {
  if (sections.some((section) => !section.title.trim() || !section.body.trim())) {
    return 'Give every section a title and some text before publishing.';
  }
  return null;
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ContractDraftEditor({
  organizationName,
  saved,
  nextNumber,
  saving = false,
  publishing = false,
  deleting = false,
  error,
  onSave,
  onPublish,
  onDelete,
}: ContractDraftEditorProps) {
  const [sections, setSections] = useState(saved);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const changed = JSON.stringify(sections) !== JSON.stringify(saved);
  const problem = publishProblem(saved);

  const change = (index: number, patch: Partial<ApiContractSection>) =>
    setSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={500}>Draft of version {nextNumber}</Text>
        <SegmentedControl
          size="xs"
          value={view}
          onChange={setView}
          data={[
            { label: 'Edit', value: 'edit' },
            { label: 'Preview', value: 'preview' },
          ]}
        />
      </Group>

      {view === 'preview' ? (
        <Card withBorder>
          <ContractText sections={sections} />
        </Card>
      ) : (
        <Stack>
          {sections.map((section, index) => (
            <Card withBorder key={index} padding="sm">
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  {section.kind === 'privacy_policy' ? (
                    <Badge variant="light">Privacy policy</Badge>
                  ) : (
                    <Badge variant="light" color="gray">
                      Section {index + 1}
                    </Badge>
                  )}
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Move ${section.title || 'section'} up`}
                      disabled={index === 0}
                      onClick={() => setSections(move(sections, index, index - 1))}
                    >
                      <IconArrowUp size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Move ${section.title || 'section'} down`}
                      disabled={index === sections.length - 1}
                      onClick={() => setSections(move(sections, index, index + 1))}
                    >
                      <IconArrowDown size={16} />
                    </ActionIcon>
                    {section.kind !== 'privacy_policy' && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove ${section.title || 'section'}`}
                        onClick={() => setSections(sections.filter((_, i) => i !== index))}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
                <TextInput
                  label="Title"
                  value={section.title}
                  onChange={(e) => change(index, { title: e.currentTarget.value })}
                />
                <Textarea
                  label="Text"
                  description="Markdown"
                  autosize
                  minRows={4}
                  maxRows={16}
                  value={section.body}
                  onChange={(e) => change(index, { body: e.currentTarget.value })}
                />
              </Stack>
            </Card>
          ))}
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setSections([...sections, { kind: 'custom', title: '', body: '' }])}
          >
            Add a section
          </Button>
        </Stack>
      )}

      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}

      {confirmingPublish ? (
        <Alert color="yellow" title={`Publish version ${nextNumber}?`}>
          <Stack>
            <Text size="sm">
              Everyone — you included — will need to agree to it before they can reach{' '}
              {organizationName} again, even if only a typo changed. Everyone else is signed out,
              and every connected app is disconnected until its user connects it again; you’ll be
              asked to agree straight away. Once published, it can’t be changed.
            </Text>
            <FormActions>
              <Button variant="default" onClick={() => setConfirmingPublish(false)}>
                Cancel
              </Button>
              <Button
                color="yellow"
                loading={publishing}
                onClick={() => {
                  onPublish();
                  setConfirmingPublish(false);
                }}
              >
                Publish version {nextNumber}
              </Button>
            </FormActions>
          </Stack>
        </Alert>
      ) : (
        <Group justify="space-between">
          <Button variant="subtle" color="red" onClick={onDelete} loading={deleting}>
            Delete draft
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={() => setSections(saved)} disabled={!changed}>
              Undo changes
            </Button>
            <Button onClick={() => onSave(sections)} disabled={!changed} loading={saving}>
              Save draft
            </Button>
            <Button
              variant="outline"
              disabled={changed || !!problem}
              title={changed ? 'Save the draft first' : (problem ?? undefined)}
              onClick={() => setConfirmingPublish(true)}
            >
              Publish…
            </Button>
          </Group>
        </Group>
      )}
      {!changed && problem && (
        <Text size="xs" c="dimmed">
          {problem}
        </Text>
      )}
    </Stack>
  );
}
