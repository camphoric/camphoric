/**
 * The OAuth authorization endpoint's page, `/o/authorize` (SPEC §4, §6; §15 DR-151,
 * DR-152). Apps send people here with their authorization request in the query
 * string, which goes to `/api/oauth/authorize` exactly as sent. The page:
 *
 * 1. signs the person in, if they aren't;
 * 2. asks for every organization's terms they have yet to agree to, in turn, as the
 *    admin does (the contract gate) — declining tells the app `access_denied` and
 *    signs out;
 * 3. shows the consent screen; Connect or Cancel sends them back to the app.
 *
 * A request that can't be approved is sent back to the app with its error, or, when
 * it can't be trusted to say where to go, explained here.
 */

import { Anchor, Button, Card, Center, Group, Stack, Text, Title } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { useRouter } from '@tanstack/react-router';
import type { ApiOAuthRefusal } from 'api-types';
import { FullScreenLoading } from 'components/Loading';
import { isAuthenticated, useCurrentUser, useLogout } from 'hooks/auth';
import { ContractGate } from 'navigation/ContractGate';
import { initialSearch } from 'navigation/initialSearch';
import { ForgotPasswordForm, SignInForm } from 'navigation/Login';
import { type ReactNode, useEffect, useState } from 'react';
import { oauthRefusal, useDecideOAuthRequest, useOAuthRequest } from 'store/apps';
import { ApiError, apiErrorMessage } from 'utils/fetch';
import { leavePage } from 'utils/leavePage';

import { ConsentForm } from './ConsentForm';

export function AuthorizePage() {
  useDocumentTitle('Connect an app — Camphoric');
  // The app's request, passed on exactly as it was sent (not as the router rewrites it).
  const query = initialSearch;
  useKeepRequestInAddress(query);
  const { data: user, isLoading } = useCurrentUser();
  const signedIn = isAuthenticated(user);
  const request = useOAuthRequest(query, signedIn);
  const decide = useDecideOAuthRequest(query);
  const logout = useLogout();
  const [leaving, setLeaving] = useState(false);
  const [forgot, setForgot] = useState(false);
  // Connecting or cancelling refused, with nowhere the app can be told.
  const [stopped, setStopped] = useState<ApiOAuthRefusal | null>(null);
  // Declined the terms, but the app couldn't be told.
  const [declinedUntold, setDeclinedUntold] = useState(false);

  // The request can't be approved: the app is told, where it can be.
  const refusal = oauthRefusal(request.error) ?? stopped;
  const tellApp = oauthRefusal(request.error)?.redirect_to ?? null;
  useEffect(() => {
    if (tellApp) leavePage(tellApp);
  }, [tellApp]);

  const leaveFor = (url: string) => {
    setLeaving(true);
    leavePage(url);
  };
  const signOutAndLeaveFor = (url: string) => {
    setLeaving(true);
    logout.mutate(undefined, { onSettled: () => leavePage(url) });
  };
  const answer = (allow: boolean) =>
    decide.mutate(allow, {
      onSuccess: ({ redirect_to }) => leaveFor(redirect_to),
      onError: (error) => {
        const refused = oauthRefusal(error);
        if (refused?.redirect_to) leaveFor(refused.redirect_to);
        else if (refused) setStopped(refused);
        // Anything else is shown on the consent screen, to try again.
      },
    });
  // Declining terms signs out, whatever happens; the app hears `access_denied` if it can.
  const declineTerms = () =>
    decide.mutate(false, {
      onSuccess: ({ redirect_to }) => signOutAndLeaveFor(redirect_to),
      onError: (error) => {
        const tellAppAt = oauthRefusal(error)?.redirect_to;
        if (tellAppAt) {
          signOutAndLeaveFor(tellAppAt);
          return;
        }
        setDeclinedUntold(true);
        logout.mutate();
      },
    });

  if (leaving || tellApp) return <FullScreenLoading message="Returning to the app…" />;
  if (declinedUntold) {
    return (
      <Message title="You’re signed out">
        <Text size="sm">
          You didn’t agree to the terms, so you’ve been signed out and the app wasn’t connected.
          Camphoric couldn’t tell the app; go back to it to start again.
        </Text>
      </Message>
    );
  }
  if (isLoading && !user) return <FullScreenLoading message="Checking your session…" />;

  if (!signedIn) {
    return (
      <Frame width={400}>
        {forgot ? (
          <Stack>
            <Title order={3}>Forgot your password?</Title>
            <ForgotPasswordForm onBack={() => setForgot(false)} />
          </Stack>
        ) : (
          <SignInForm
            intro={
              <div>
                <Title order={3}>Sign in to Camphoric</Title>
                <Text size="sm" c="dimmed">
                  Sign in to choose whether to connect an app to your account.
                </Text>
              </div>
            }
            onForgot={() => setForgot(true)}
          />
        )}
      </Frame>
    );
  }

  if (refusal) {
    return (
      <Message title="This app can’t connect">
        <Text size="sm">{refusal.description || refusal.error}</Text>
        <Text size="sm">Tell whoever runs the app.</Text>
      </Message>
    );
  }
  if (request.isError && request.error instanceof ApiError && request.error.status === 403) {
    return (
      <Message title="You can’t connect apps">
        <Text size="sm">{apiErrorMessage(request.error)}</Text>
        <Group>
          <Button variant="default" onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign in as someone else
          </Button>
        </Group>
      </Message>
    );
  }
  if (request.isError) {
    return (
      <Message title="The app’s request couldn’t be checked">
        <Text size="sm">{apiErrorMessage(request.error)}</Text>
        <Group>
          <Button onClick={() => void request.refetch()} loading={request.isFetching}>
            Try again
          </Button>
        </Group>
      </Message>
    );
  }
  if (request.isPending || !user) {
    return <FullScreenLoading message="Checking the app’s request…" />;
  }

  return (
    <ContractGate onDecline={declineTerms} declining={decide.isPending || logout.isPending}>
      <Frame width={560}>
        <ConsentForm
          request={request.data}
          user={user}
          error={decide.isError ? apiErrorMessage(decide.error) : null}
          connecting={decide.isPending && decide.variables}
          cancelling={decide.isPending && !decide.variables}
          onConnect={() => answer(true)}
          onCancel={() => answer(false)}
          onSwitchAccount={() => logout.mutate()}
        />
      </Frame>
    </ContractGate>
  );
}

/**
 * Put the app's request back in the address bar as it was sent, each time the router
 * has rewritten the address into its own form (DR-83), so reloading the page sends the
 * same request again rather than the rewritten one.
 */
function useKeepRequestInAddress(query: string) {
  const router = useRouter();
  useEffect(() => {
    const restore = () => {
      if (!query || window.location.search === `?${query}`) return;
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}?${query}${window.location.hash}`,
      );
    };
    restore();
    return router.subscribe('onResolved', restore);
  }, [router, query]);
}

function Frame({ width, children }: { width: number; children: ReactNode }) {
  return (
    <Center mih="100vh" p="md">
      <Card withBorder shadow="sm" radius="md" w={width} maw="100%" p="lg">
        {children}
      </Card>
    </Center>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Frame width={480}>
      <Stack>
        <Title order={3}>{title}</Title>
        {children}
        <Anchor href="/admin" size="sm">
          Go to Camphoric
        </Anchor>
      </Stack>
    </Frame>
  );
}
