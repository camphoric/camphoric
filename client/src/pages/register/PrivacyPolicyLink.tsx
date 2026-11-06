/**
 * A link to the terms of the event's organization, its privacy policy among them,
 * at the foot of the registration steps (SPEC §7; §15 DR-145, DR-153). None when it
 * has published none.
 */

import { Anchor, Text } from '@mantine/core';
import type { ApiRegister } from 'api-types';

export function PrivacyPolicyLink({ policy }: { policy: ApiRegister['privacyPolicy'] }) {
  if (!policy) return null;
  return (
    <Text size="sm" ta="center" c="dimmed">
      <Anchor
        href={`/organizations/${policy.organization}/privacy-policy`}
        target="_blank"
        rel="noreferrer"
        size="sm"
      >
        Privacy policy and terms
      </Anchor>
    </Text>
  );
}
