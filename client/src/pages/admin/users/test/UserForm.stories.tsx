/**
 * Stories for adding and editing users (SPEC §8.10): as an Admin, as a
 * superuser (with Django access and password choices), editing yourself, and
 * a superuser setting someone's password. The story prints what would be
 * saved. Run `npm run storybook`.
 */

import { Code, Stack } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';
import { useState } from 'react';

import { SetUserPasswordModal } from '../SetUserPasswordModal';
import { UserForm, type UserFormProps } from '../UserForm';
import { sampleUser } from './userFixtures';

function Harness(props: Partial<UserFormProps>) {
  const [saved, setSaved] = useState<unknown>(null);
  return (
    <Stack p="md" maw={640}>
      <UserForm onSubmit={setSaved} onCancel={() => setSaved(null)} {...props} />
      {saved !== null && (
        <Code block data-testid="saved">
          {JSON.stringify(saved, null, 2)}
        </Code>
      )}
    </Stack>
  );
}

export default { title: 'User Form' } satisfies Meta;

export const NewUser: StoryFn = () => <Harness />;
export const NewUserAsSuperuser: StoryFn = () => <Harness isSuperuser />;
export const Edit: StoryFn = () => <Harness user={sampleUser()} />;
export const EditYourself: StoryFn = () => (
  <Harness user={sampleUser({ role: 'admin' })} isSelf isSuperuser />
);

export const SetPassword: StoryFn = () => {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Stack p="md">
      {saved && <Code data-testid="saved">{saved}</Code>}
      <SetUserPasswordModal
        username={open ? 'pat' : null}
        onClose={() => setOpen(false)}
        onSubmit={(password, requireChange) => {
          setSaved(`${password.length} characters, require change: ${requireChange}`);
          setOpen(false);
        }}
      />
    </Stack>
  );
};
