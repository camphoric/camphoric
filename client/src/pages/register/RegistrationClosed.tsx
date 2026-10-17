/**
 * Shown when the event is not open for registration and there's no invitation
 * (SPEC §7).
 */

import { Alert, Container } from '@mantine/core';

export function RegistrationClosed() {
  return (
    <Container size="sm" py="xl">
      <Alert color="gray" variant="light" title="Registration is closed">
        Registration for this event isn't open right now. Please check back later or contact the
        organizers.
      </Alert>
    </Container>
  );
}
