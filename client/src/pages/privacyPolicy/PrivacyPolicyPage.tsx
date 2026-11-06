/**
 * An organization's public terms, its privacy policy among them,
 * `/organizations/$organizationId/privacy-policy` (SPEC §4, §7; §15 DR-145, DR-153):
 * its latest contract version, with the version and its effective date. No sign-in:
 * it's for the registrants whose details the organization holds, who never sign in.
 */

import { Alert, Container, Stack, Text, Title } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { useParams } from '@tanstack/react-router';
import type { ApiPrivacyPolicy } from 'api-types';
import { ContractText, formatEffectiveDate } from 'components/Contract';
import { FullScreenLoading } from 'components/Loading';
import { usePrivacyPolicy } from 'store/contracts';

export function PrivacyPolicyPage() {
  const { organizationId } = useParams({ from: '/organizations/$organizationId/privacy-policy' });
  const policy = usePrivacyPolicy(Number(organizationId));
  useDocumentTitle(
    policy.data ? `Privacy policy and terms — ${policy.data.organization_name}` : 'Privacy policy',
  );

  if (policy.isPending) return <FullScreenLoading message="Loading the privacy policy…" />;
  if (policy.isError || !policy.data) {
    return (
      <Container size="sm" py="xl">
        <Alert color="gray" variant="light" title="No privacy policy here">
          This organization hasn’t published a privacy policy here. Please contact the organizers.
        </Alert>
      </Container>
    );
  }
  return <PrivacyPolicyView policy={policy.data} />;
}

export function PrivacyPolicyView({ policy }: { policy: ApiPrivacyPolicy }) {
  return (
    <Container size="md" py="xl">
      <Stack>
        <div>
          <Title order={2}>{policy.organization_name} terms</Title>
          <Text c="dimmed" size="sm">
            Version {policy.number}, effective {formatEffectiveDate(policy.published_at)}
          </Text>
        </div>
        <ContractText body={policy.body} />
      </Stack>
    </Container>
  );
}
