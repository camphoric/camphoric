/**
 * Public splash / default page (SPEC §4). Lists public events with their
 * open/closed status and links to admin. Phase 1 renders a placeholder with the
 * admin link wired so the public/admin split is navigable end to end.
 */

import { Anchor, Stack } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { Placeholder } from 'pages/Placeholder';

export function Splash() {
  return (
    <Placeholder title="Camphoric" phase="Public event list — Phase 3">
      <Stack gap="xs">
        <Anchor component={Link} to="/admin">
          Go to admin →
        </Anchor>
      </Stack>
    </Placeholder>
  );
}
