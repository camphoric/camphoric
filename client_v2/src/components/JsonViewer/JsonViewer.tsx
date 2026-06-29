/**
 * Read-only rendering of an arbitrary object as formatted JSON (SPEC §9.6).
 * Backs the "raw record JSON" debugging aids on admin detail screens (§8).
 */

import { Code } from '@mantine/core';

interface JsonViewerProps {
  value: unknown;
}

export function JsonViewer({ value }: JsonViewerProps) {
  return (
    <Code block style={{ maxHeight: 400, overflow: 'auto' }}>
      {JSON.stringify(value, null, 2)}
    </Code>
  );
}
