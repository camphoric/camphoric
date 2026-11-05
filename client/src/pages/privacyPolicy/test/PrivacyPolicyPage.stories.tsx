/**
 * Stories for an organization's public privacy policy (SPEC §4, §7; §15 DR-145).
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
      title: PUBLISHED_CONTRACT.sections[0].title,
      body: PUBLISHED_CONTRACT.sections[0].body,
      number: 2,
      published_at: PUBLISHED_CONTRACT.published_at,
    }}
  />
);
