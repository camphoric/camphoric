/**
 * The problems found rendering a template (SPEC §9.6): errors, then warnings,
 * each with its line. Given `onJump`, a problem with a line is a button that
 * moves the editor there.
 */

import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react';
import type { TemplateDiagnostic } from 'api-types';

interface TemplateDiagnosticsProps {
  diagnostics: TemplateDiagnostic[];
  onJump?: (diagnostic: TemplateDiagnostic) => void;
}

function where(d: TemplateDiagnostic) {
  const place = d.line ? `Line ${d.line}${d.column ? `, column ${d.column}` : ''}` : '';
  const field = d.field !== 'template' ? `${d.field[0].toUpperCase()}${d.field.slice(1)}` : '';
  return [field, place].filter(Boolean).join(' · ');
}

export function TemplateDiagnostics({ diagnostics, onJump }: TemplateDiagnosticsProps) {
  if (!diagnostics.length) return null;
  const sorted = [...diagnostics].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );

  return (
    <Stack gap={4} role="list" aria-label="Template problems">
      {sorted.map((d, i) => {
        const color = d.severity === 'error' ? 'red' : 'yellow';
        const Icon = d.severity === 'error' ? IconAlertCircle : IconAlertTriangle;
        const content = (
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <Icon size={18} color={`var(--mantine-color-${color}-6)`} aria-label={d.severity} />
            <Text size="sm">
              {where(d) && (
                <Text span fw={600} size="sm">
                  {where(d)}:{' '}
                </Text>
              )}
              {d.message}
            </Text>
          </Group>
        );
        return (
          <div role="listitem" key={`${d.line}-${d.column}-${i}`}>
            {onJump && d.line ? (
              <UnstyledButton onClick={() => onJump(d)} title="Go to this line">
                {content}
              </UnstyledButton>
            ) : (
              content
            )}
          </div>
        );
      })}
    </Stack>
  );
}
