/**
 * Stories for the contract an organization asks people to agree to before
 * reaching it (SPEC §6; §15 DR-145, DR-151): its text, and agreeing or declining.
 * Run `npm run storybook`.
 */

import { Card } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { ContractAgreementForm } from '../ContractAgreementForm';
import { ContractText } from '../ContractText';
import { PUBLISHED_CONTRACT } from './contractFixtures';

function Frame(props: Partial<Parameters<typeof ContractAgreementForm>[0]>) {
  return (
    <Card withBorder padding="lg" m="md" maw={760}>
      <ContractAgreementForm
        contract={PUBLISHED_CONTRACT}
        onAgree={() => undefined}
        onDecline={() => undefined}
        {...props}
      />
    </Card>
  );
}

export default { title: 'Contract Agreement Form' } satisfies Meta;

export const AskingToAgree: StoryFn = () => <Frame />;
/** One of several organizations asked for in turn after signing in (DR-151). */
export const OneOfSeveral: StoryFn = () => <Frame progress={{ position: 2, total: 3 }} />;
export const Agreeing: StoryFn = () => <Frame agreeing />;
export const TermsChanged: StoryFn = () => (
  <Frame error="These terms have changed since you opened them. Read the latest version, then agree to it." />
);
/** A version's text alone, as rereading an agreement shows it. */
export const TextOnly: StoryFn = () => (
  <Card withBorder padding="lg" m="md" maw={760}>
    <ContractText body={PUBLISHED_CONTRACT.body} />
  </Card>
);
