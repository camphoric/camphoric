/**
 * Stories for the OAuth consent screen (SPEC §6; §15 DR-152): what an app asks to
 * do, for whom, and Cancel or Connect. Run `npm run storybook`.
 */

import { Card } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { ConsentForm } from '../ConsentForm';
import { OAUTH_REQUEST, SIGNED_IN } from './oauthFixtures';

function Frame(props: Partial<Parameters<typeof ConsentForm>[0]>) {
  return (
    <Card withBorder padding="lg" m="md" maw={560}>
      <ConsentForm
        request={OAUTH_REQUEST}
        user={SIGNED_IN}
        onConnect={() => undefined}
        onCancel={() => undefined}
        onSwitchAccount={() => undefined}
        {...props}
      />
    </Card>
  );
}

export default { title: 'Consent Form' } satisfies Meta;

export const AsksToReadAndWrite: StoryFn = () => <Frame />;
/** A Reporter can't change anything, so an app acting for them can't either. */
export const ReporterCantWrite: StoryFn = () => (
  <Frame
    user={{
      ...SIGNED_IN,
      username: 'sample.reporter',
      last_name: 'Reporter',
      role: 'reporter',
    }}
    request={{ ...OAUTH_REQUEST, write_limited_by_role: true }}
  />
);
export const ReadOnly: StoryFn = () => (
  <Frame request={{ ...OAUTH_REQUEST, scopes: OAUTH_REQUEST.scopes.slice(0, 1) }} />
);
export const Connecting: StoryFn = () => <Frame connecting />;
export const ConnectFailed: StoryFn = () => (
  <Frame error="Agree to the organization’s terms before continuing." />
);
