/**
 * Stories for editing an organization's contract draft and seeing who agreed
 * to a version (SPEC §8.1; §15 DR-145). Run `npm run storybook`.
 */

import { Paper } from '@mantine/core';
import type { Meta, StoryFn } from '@storybook/react-vite';

import { ContractAgreementsTable } from '../ContractAgreementsTable';
import { ContractDraftEditor } from '../ContractDraftEditor';
import { AGREEMENTS, DRAFT_SECTIONS } from './contractVersions';

function Frame({
  saved = DRAFT_SECTIONS,
  error,
}: {
  saved?: typeof DRAFT_SECTIONS;
  error?: string;
}) {
  return (
    <Paper withBorder p="md" m="md" maw={760}>
      <ContractDraftEditor
        organizationName="Lark Camp"
        saved={saved}
        nextNumber={2}
        error={error}
        onSave={() => undefined}
        onPublish={() => undefined}
        onDelete={() => undefined}
      />
    </Paper>
  );
}

export default { title: 'Contract Draft Editor' } satisfies Meta;

export const ReadyToPublish: StoryFn = () => <Frame />;
/** The first draft: one empty privacy policy, which can't be published yet. */
export const FirstDraft: StoryFn = () => (
  <Frame saved={[{ kind: 'privacy_policy', title: 'Privacy Policy', body: '' }]} />
);
export const SaveFailed: StoryFn = () => (
  <Frame error="Someone else changed this since you opened it." />
);
export const WhoAgreed: StoryFn = () => (
  <Paper withBorder p="md" m="md" maw={760}>
    <ContractAgreementsTable agreements={AGREEMENTS} />
  </Paper>
);
