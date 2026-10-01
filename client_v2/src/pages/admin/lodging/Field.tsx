/**
 * A labelled value in a lodging details panel: a small dimmed label over the
 * value, which keeps its line breaks (notes and comments are free text).
 */

import { Text } from '@mantine/core';
import type { ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {children}
      </Text>
    </div>
  );
}
