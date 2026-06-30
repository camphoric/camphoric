/**
 * Registration flow container (SPEC §7). Before any step renders it loads the
 * registration config, shows a spinner while fetching, sets the document title,
 * presents a closed-registration message when the event isn't open and there's
 * no invitation, and otherwise surfaces invitation context and renders the
 * current step.
 */

import { Alert, Container, Stack } from '@mantine/core';
import { useDocumentTitle } from '@mantine/hooks';
import { Outlet, useParams } from '@tanstack/react-router';
import { ErrorBoundary } from 'components/ErrorBoundary';
import { FullScreenLoading } from 'components/Loading';
import { useRegistrationConfig } from 'store/registrationApi';

import { InvitationInfo } from './InvitationInfo';
import { RegistrationClosed } from './RegistrationClosed';

export function RegisterContainer() {
  const { eventId } = useParams({ strict: false });
  const { data: config, isLoading, isError } = useRegistrationConfig(eventId);

  useDocumentTitle(config?.dataSchema.title ?? 'Register');

  if (isLoading) {
    return <FullScreenLoading message="Loading registration…" />;
  }

  if (isError || !config) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" variant="light" title="Couldn't load registration">
          Something went wrong loading this event's registration. Please try again.
        </Alert>
      </Container>
    );
  }

  if (!config.event.is_open && !config.invitation) {
    return <RegistrationClosed />;
  }

  return (
    <Container size="md" py="lg">
      <Stack>
        <InvitationInfo
          invitation={config.invitation}
          registrationType={config.registrationType}
          error={config.invitationError}
        />
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </Stack>
    </Container>
  );
}
