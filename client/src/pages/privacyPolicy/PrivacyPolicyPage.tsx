/**
 * An organization's public privacy policy, `/organizations/$organizationId/privacy-policy`
 * (SPEC §4, §7; §15 DR-145): the privacy policy section of its latest contract
 * version, with the version and its effective date. No sign-in: it's for the
 * registrants whose details the organization holds, who never sign in.
 */

import { Alert, Container, Stack, Text, Title } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { useParams } from '@tanstack/react-router';
import type { ApiPrivacyPolicy } from 'api-types';
import { formatEffectiveDate } from 'components/Contract';
import { FullScreenLoading } from 'components/Loading';
import { markdownToHtml, RenderedMarkdown } from 'components/templating';
import { useMemo } from 'react';
import { usePrivacyPolicy } from 'store/contracts';

export function PrivacyPolicyPage() {
  const { organizationId } = useParams({ from: '/organizations/$organizationId/privacy-policy' });
  const policy = usePrivacyPolicy(Number(organizationId));
  useDocumentTitle(
    policy.data ? `${policy.data.title} — ${policy.data.organization_name}` : 'Privacy policy',
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
  const html = useMemo(() => markdownToHtml(policy.body), [policy.body]);
  return (
    <Container size="md" py="xl">
      <Stack>
        <div>
          <Text c="dimmed" size="sm">
            {policy.organization_name}
          </Text>
          <Title order={2}>{policy.title}</Title>
          <Text c="dimmed" size="sm">
            Version {policy.number}, effective {formatEffectiveDate(policy.published_at)}
          </Text>
        </div>
        <RenderedMarkdown html={html} />
      </Stack>
    </Container>
  );
}
