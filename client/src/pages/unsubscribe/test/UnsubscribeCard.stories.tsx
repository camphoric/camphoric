/**
 * Stories for the group-email unsubscribe page's card (SPEC §8.9; §15 DR-48,
 * DR-154): asking to confirm, done, and a link that can't be used. Run
 * `npm run storybook`.
 */

import { Card } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { UnsubscribeCard, type UnsubscribeCardProps } from '../UnsubscribeCard';
import { LINK } from './fixtures';

function Frame(props: UnsubscribeCardProps) {
  return (
    <Card withBorder padding="lg" m="md" maw={480}>
      <UnsubscribeCard {...props} />
    </Card>
  );
}

export default { title: 'Unsubscribe Card' } satisfies Meta;

export const Ask: StoryFn = () => <Frame state="ask" link={LINK} onConfirm={() => undefined} />;
export const Confirming: StoryFn = () => (
  <Frame state="ask" link={LINK} onConfirm={() => undefined} confirming />
);
export const ConfirmFailed: StoryFn = () => (
  <Frame state="ask" link={LINK} onConfirm={() => undefined} error="API 500 Server Error" />
);
export const Done: StoryFn = () => <Frame state="done" link={{ ...LINK, unsubscribed: true }} />;
/** A long address wraps rather than running off a phone's screen. */
export const LongAddress: StoryFn = () => (
  <Frame
    state="ask"
    link={{
      ...LINK,
      address: 'a.very.long.address.for.someone.with.a.long.name@subdomain.example-camp.org',
    }}
    onConfirm={() => undefined}
  />
);
export const ChangedLink: StoryFn = () => (
  <Frame
    state="problem"
    detail="The unsubscribe link is incomplete or has been changed. Try the link in the email again."
  />
);
export const EventGone: StoryFn = () => (
  <Frame
    state="problem"
    detail="The event this email was about no longer exists, so it won’t send you anything more."
  />
);
export const Unreachable: StoryFn = () => (
  <Frame
    state="unreachable"
    detail="Something went wrong checking this link. Please try again in a moment."
    onRetry={() => undefined}
  />
);
