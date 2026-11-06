/**
 * The terms you've agreed to (SPEC §6; §15 DR-145): each contract version you
 * agreed to, newest first, with when you agreed, to reread its text.
 */

import { Accordion, Alert, Modal, Stack, Text } from '@mantine/core';
import type { ApiMyContractAgreement } from 'api-types';
import { ContractText, formatEffectiveDate } from 'components/Contract';
import { InlineLoading } from 'components/Loading';
import { useMyContractAgreements } from 'store/contracts';
import { apiErrorMessage } from 'utils/fetch';

interface MyAgreementsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function MyAgreementsModal({ opened, onClose }: MyAgreementsModalProps) {
  const agreements = useMyContractAgreements(opened);
  return (
    <Modal opened={opened} onClose={onClose} title="Terms you’ve agreed to" size="xl">
      {agreements.isPending ? (
        <InlineLoading />
      ) : agreements.isError ? (
        <Alert color="red">{apiErrorMessage(agreements.error)}</Alert>
      ) : (
        <MyAgreementsList agreements={agreements.data} />
      )}
    </Modal>
  );
}

export function MyAgreementsList({ agreements }: { agreements: ApiMyContractAgreement[] }) {
  if (agreements.length === 0) {
    return <Text c="dimmed">You haven’t been asked to agree to any terms.</Text>;
  }
  return (
    <Accordion variant="separated">
      {agreements.map((agreement) => (
        <Accordion.Item key={agreement.id} value={String(agreement.id)}>
          <Accordion.Control>
            <Stack gap={0}>
              <Text fw={500}>
                {agreement.contract.organization_name}, version {agreement.contract.number}
              </Text>
              <Text size="xs" c="dimmed">
                Effective {formatEffectiveDate(agreement.contract.published_at)} · you agreed{' '}
                {new Date(agreement.agreed_at).toLocaleString()}
              </Text>
            </Stack>
          </Accordion.Control>
          <Accordion.Panel>
            <ContractText body={agreement.contract.body} />
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
