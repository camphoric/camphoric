/**
 * Stories for an organization's public terms, its privacy policy among them
 * (SPEC §4, §7; §15 DR-145, DR-153).
 * Run `npm run storybook`.
 */

import type { Meta, StoryFn } from '@storybook/react-vite';
import { PUBLISHED_CONTRACT } from 'components/Contract/test/contractFixtures';

import { PrivacyPolicyView } from '../PrivacyPolicyPage';

export default { title: 'Privacy Policy Page' } satisfies Meta;

export const Published: StoryFn = () => (
  <PrivacyPolicyView
    policy={{
      organization: 3,
      organization_name: 'Lark Camp',
      body: PUBLISHED_CONTRACT.body,
      number: 2,
      published_at: PUBLISHED_CONTRACT.published_at,
    }}
  />
);
