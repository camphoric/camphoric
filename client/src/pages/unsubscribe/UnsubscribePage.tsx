/**
 * The page a group email's unsubscribe link opens, `/unsubscribe/$token`
 * (SPEC §4, §8.9; §15 DR-48, DR-154). The emailed link,
 * `/api/unsubscribe/{token}/`, sends a browser here; the page shows what the
 * link unsubscribes and asks to confirm, so opening it (or a link scanner
 * fetching it) changes nothing. Confirming records it. No sign-in: the signed
 * token is the permission.
 */

import { Card, Center } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { useParams } from '@tanstack/react-router';
import { FullScreenLoading } from 'components/Loading';
import { useEffect } from 'react';
import { unsubscribeProblem, useUnsubscribe, useUnsubscribeLink } from 'store/unsubscribe';
import { apiErrorMessage } from 'utils/fetch';

import { UnsubscribeCard, type UnsubscribeCardProps } from './UnsubscribeCard';

export function UnsubscribePage() {
  const { token } = useParams({ from: '/unsubscribe/$token' });
  const link = useUnsubscribeLink(token);
  const confirm = useUnsubscribe(token);
  useNoIndex();

  const problem = unsubscribeProblem(link.error) ?? unsubscribeProblem(confirm.error);
  let card: UnsubscribeCardProps | null = null;
  if (problem) {
    card = { state: 'problem', detail: problem.detail };
  } else if (link.isError) {
    card = {
      state: 'unreachable',
      detail: 'Something went wrong checking this link. Please try again in a moment.',
      onRetry: () => void link.refetch(),
      retrying: link.isFetching,
    };
  } else if (link.data?.unsubscribed) {
    card = { state: 'done', link: link.data };
  } else if (link.data) {
    card = {
      state: 'ask',
      link: link.data,
      onConfirm: () => confirm.mutate(),
      confirming: confirm.isPending,
      error: confirm.isError ? apiErrorMessage(confirm.error) : null,
    };
  }

  useDocumentTitle(
    card?.state === 'done'
      ? 'Unsubscribed'
      : card?.state === 'problem'
        ? 'Unsubscribe link problem'
        : 'Unsubscribe',
  );

  if (!card) return <FullScreenLoading message="Checking the link…" />;
  return (
    <Center mih="100vh" p="md">
      <Card withBorder shadow="sm" radius="md" w={480} maw="100%" p="lg">
        <UnsubscribeCard {...card} />
      </Card>
    </Center>
  );
}

/**
 * Ask search engines not to index the page while it's showing: it names the
 * recipient's address, and a forwarded or archived email can expose the link.
 */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
