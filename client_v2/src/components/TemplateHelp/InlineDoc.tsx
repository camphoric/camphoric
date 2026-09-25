/**
 * A doc string from the variable spec, whose `backticked` names are shown as
 * code. Nothing else is interpreted, so no HTML is ever rendered.
 */

import { Code, Text, type TextProps } from '@mantine/core';

export function InlineDoc({ children, ...props }: TextProps & { children: string }) {
  const parts = children.split(/(`[^`]+`)/g);
  return (
    <Text size="sm" c="dimmed" {...props}>
      {parts.map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
          <Code key={index}>{part.slice(1, -1)}</Code>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
