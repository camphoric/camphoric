/**
 * Editing an organization's contract draft (SPEC §8.1; §15 DR-145, DR-153): its terms,
 * one Markdown document whose headings are its sections, with a preview. Publishing
 * (once saved) makes it the next version, which everyone must then agree to —
 * signing everyone else out and disconnecting every app (DR-151).
 */

import { Alert, Button, Card, Group, SegmentedControl, Stack, Text, Textarea } from '@mantine/core';
import { ContractText } from 'components/Contract';
import { FormActions } from 'components/FormActions';
import { useState } from 'react';

interface ContractDraftEditorProps {
  organizationName: string;
  /** The draft's text as saved. */
  saved: string;
  /** The number the draft will have once published. */
  nextNumber: number;
  saving?: boolean;
  publishing?: boolean;
  deleting?: boolean;
  error?: string | null;
  onSave: (body: string) => void;
  onPublish: () => void;
  onDelete: () => void;
}

/** Why the draft can't be published yet, or null. */
export function publishProblem(body: string): string | null {
  return body.trim() ? null : 'Write the terms before publishing them.';
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
  const [body, setBody] = useState(saved);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const changed = body !== saved;
  const problem = publishProblem(saved);

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
          {body.trim() ? (
            <ContractText body={body} />
          ) : (
            <Text size="sm" c="dimmed">
              Nothing written yet.
            </Text>
          )}
        </Card>
      ) : (
        <Textarea
          label="Terms"
          description="Markdown. Use headings (## Privacy policy) for the sections, such as the privacy policy and a liability waiver."
          autosize
          minRows={12}
          maxRows={30}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
        />
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
            <Button variant="default" onClick={() => setBody(saved)} disabled={!changed}>
              Undo changes
            </Button>
            <Button onClick={() => onSave(body)} disabled={!changed} loading={saving}>
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
