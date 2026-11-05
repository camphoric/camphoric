/**
 * Asks someone to agree to an organization's latest contract version before
 * going further (SPEC §6; §15 DR-145): its whole text, in order, and two
 * separate actions — agree, or decline and sign out. Nothing is chosen for
 * them, and the wording says agreeing is required to continue.
 */

import { Alert, Anchor, Button, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import type { ApiPublishedContract } from 'api-types';

import { ContractText, formatEffectiveDate } from './ContractText';

/** The wording of the agree action, recorded with each agreement. */
export const ASSENT_TEXT = 'I agree';

/** Where these terms come among those asked for one after another (DR-151). */
export interface ContractProgress {
  position: number;
  total: number;
}

interface ContractAgreementFormProps {
  contract: ApiPublishedContract;
  /** Shown as "Organization 2 of 3" when there's more than one to agree to. */
  progress?: ContractProgress;
  /** The terms changed since this version was opened, or agreeing failed. */
  error?: string | null;
  agreeing?: boolean;
  declining?: boolean;
  onAgree: () => void;
  onDecline: () => void;
  /** How tall the text may be before it scrolls; the page's height when unset. */
  textHeight?: number | string;
}

export function ContractAgreementForm({
  contract,
  progress,
  error,
  agreeing = false,
  declining = false,
  onAgree,
  onDecline,
  textHeight = '55vh',
}: ContractAgreementFormProps) {
  const policyPath = `/organizations/${contract.organization}/privacy-policy`;
  return (
    <Stack>
      <div>
        {progress && progress.total > 1 && (
          <Text size="sm" c="dimmed">
            Organization {progress.position} of {progress.total}
          </Text>
        )}
        <Title order={3}>{contract.organization_name} terms</Title>
        <Text size="sm" c="dimmed">
          Version {contract.number}, effective {formatEffectiveDate(contract.published_at)}
        </Text>
      </div>
      <Text size="sm">
        To continue to {contract.organization_name}, read these terms and agree to them. If you
        don’t agree, you’ll be signed out.
      </Text>
      <ScrollArea.Autosize mah={textHeight} type="auto" offsetScrollbars>
        <ContractText sections={contract.sections} />
      </ScrollArea.Autosize>
      <Text size="xs" c="dimmed">
        The privacy policy is also published at{' '}
        <Anchor href={policyPath} target="_blank" rel="noreferrer" size="xs">
          {window.location.origin}
          {policyPath}
        </Anchor>
        .
      </Text>
      {error && (
        <Alert color="red" role="alert">
          {error}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDecline} loading={declining} disabled={agreeing}>
          I don’t agree — sign out
        </Button>
        <Button onClick={onAgree} loading={agreeing} disabled={declining}>
          {ASSENT_TEXT}
        </Button>
      </Group>
    </Stack>
  );
}
