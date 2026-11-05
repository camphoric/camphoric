/**
 * Who has agreed to a contract version, and what shows they did (SPEC §8.1;
 * §15 DR-145). Admins only.
 */

import { Alert, Table, Text } from '@mantine/core';
import type { ApiContractAgreement } from 'api-types';
import { InlineLoading } from 'components/Loading';
import { useContractAgreements } from 'store/contracts';
import { apiErrorMessage } from 'utils/fetch';

export function ContractAgreements({ contractId }: { contractId: number }) {
  const agreements = useContractAgreements(contractId);
  if (agreements.isPending) return <InlineLoading />;
  if (agreements.isError) return <Alert color="red">{apiErrorMessage(agreements.error)}</Alert>;
  return <ContractAgreementsTable agreements={agreements.data} />;
}

export function ContractAgreementsTable({ agreements }: { agreements: ApiContractAgreement[] }) {
  if (agreements.length === 0) return <Text c="dimmed">Nobody has agreed to it yet.</Text>;
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Who</Table.Th>
            <Table.Th>Agreed</Table.Th>
            <Table.Th>From</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {agreements.map((agreement) => (
            <Table.Tr key={agreement.id}>
              <Table.Td>
                <Text size="sm">{agreement.full_name || agreement.username}</Text>
                <Text size="xs" c="dimmed">
                  {agreement.username}
                  {agreement.email ? ` · ${agreement.email}` : ''}
                  {agreement.user === null ? ' · user deleted' : ''}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{new Date(agreement.agreed_at).toLocaleString()}</Text>
                <Text size="xs" c="dimmed">
                  “{agreement.assent_text}”
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{agreement.ip_address ?? '—'}</Text>
                <Text size="xs" c="dimmed" lineClamp={1} title={agreement.user_agent}>
                  {agreement.user_agent}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
