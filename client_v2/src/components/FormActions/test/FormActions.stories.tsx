/**
 * Stories for a form's actions (SPEC §9.6, *Form actions*; §15, DR-102): a
 * form longer than the screen, where Save stays at the bottom while the page
 * scrolls and says when there are unsaved changes; the same in a dialog whose
 * body scrolls; and a Reporter's, who has only Close. Run `npm run storybook`.
 */

import { Button, Container, Modal, Stack, TextInput, Title } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { CanEdit, PermissionsProvider, ReadOnlyFieldset, usePermissions } from 'hooks/permissions';
import { useState } from 'react';

import { FormActions } from '../FormActions';

const FIELD_COUNT = 16;
const FIELDS = Array.from({ length: FIELD_COUNT }, (_, index) => `Field ${index + 1}`);

/** A form long enough to scroll, which reports whether it has been changed. */
function LongForm({ onClose }: { onClose?: () => void }) {
  const { canEdit } = usePermissions();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  return (
    <Stack>
      <ReadOnlyFieldset>
        <Stack>
          {FIELDS.map((label) => (
            <TextInput
              key={label}
              label={label}
              value={values[label] ?? ''}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setValues((previous) => ({ ...previous, [label]: value }));
              }}
            />
          ))}
        </Stack>
      </ReadOnlyFieldset>
      <FormActions dirty={dirty}>
        {onClose && (
          <Button variant="default" onClick={onClose}>
            {canEdit ? 'Cancel' : 'Close'}
          </Button>
        )}
        <CanEdit>
          <Button onClick={() => setSaved(values)}>Save</Button>
        </CanEdit>
      </FormActions>
    </Stack>
  );
}

export default { title: 'Form Actions' } satisfies Meta;

export const LongPage: StoryFn = () => (
  <Container size="sm" py="md">
    <Title order={2} mb="md">
      Event configuration
    </Title>
    <LongForm />
  </Container>
);

export const InADialog: StoryFn = () => {
  const [opened, setOpened] = useState(true);
  return (
    <>
      <Button m="md" onClick={() => setOpened(true)}>
        Edit
      </Button>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Edit lodging">
        <LongForm onClose={() => setOpened(false)} />
      </Modal>
    </>
  );
};

export const ForAReporter: StoryFn = () => (
  <PermissionsProvider userRole="reporter">
    <Modal opened onClose={() => undefined} title="Promo code">
      <LongForm onClose={() => undefined} />
    </Modal>
  </PermissionsProvider>
);
