/**
 * Stories for the loading indicators (SPEC §9.6, §10): the full-surface one for
 * whole-screen waits and the inline one for in-place waits, each with and
 * without a message. Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';

import { FullScreenLoading, InlineLoading } from '../Loading';

export default { title: 'Loading' } satisfies Meta;

export const FullScreen: StoryFn = () => <FullScreenLoading />;

export const FullScreenWithMessage: StoryFn = () => (
  <FullScreenLoading message="Loading the event…" />
);

export const Inline: StoryFn = () => <InlineLoading />;

export const InlineWithMessage: StoryFn = () => <InlineLoading message="Loading campers…" />;
