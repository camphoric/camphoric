/**
 * Choose who a group email goes to (SPEC §8.9; §15 DR-45): campers,
 * registrations or typed addresses; for campers and registrations, conditions
 * built field by field (the recipient filter builder), and — under Advanced —
 * a Jinja filter expression and the expressions for each one's address and
 * name. Shows how many recipients the audience reaches, and who it skips and
 * why, as it changes.
 */

import {
  Alert,
  Anchor,
  Badge,
  Collapse,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { AudienceResolution, EmailAudience, EmailRecipientSource } from 'api-types';
import { RecipientFilterBuilder } from 'components/RecipientFilterBuilder';
import { useState } from 'react';
import { useRecipientFields } from 'store/groupEmail';

import { DEFAULT_EXPRESSIONS, SKIP_REASONS, SOURCE_NOUN, SOURCE_OPTIONS } from './audience';

/** Expressions are code: monospace in the box, ordinary label and description. */
const CODE_INPUT = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } };

const FILTER_EXAMPLES: Record<'registrations' | 'campers', string> = {
  registrations: 'registration.balance > 0',
  campers: "camper.lodging and camper.lodging.full_name.startswith('Cabins')",
};

/** The diagnostics' field names, and the names a template save reports them under. */
const FIELD_NAMES: Record<string, string> = { recipient_filter: 'filter_expression' };

export function audienceErrors(
  resolution: AudienceResolution | undefined,
  saveErrors: Record<string, string> = {},
) {
  const errors: Record<string, string> = {};
  for (const d of resolution?.diagnostics ?? []) {
    if (d.severity !== 'error' || !d.field) continue;
    const name = FIELD_NAMES[d.field] ?? d.field;
    errors[name] ??= d.line ? `Line ${d.line}: ${d.message}` : d.message;
  }
  return { ...errors, ...saveErrors };
}

interface AudienceEditorProps {
  eventId: string | number;
  audience: EmailAudience;
  onChange: (audience: EmailAudience) => void;
  /** Who the audience reaches (from the recipients preview). */
  resolution?: AudienceResolution;
  checking?: boolean;
  /** The preview request failed. */
  error?: string | null;
  /** Problems by field (filter, filter_expression, …), e.g. from a save. */
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
}

export function AudienceEditor({
  eventId,
  audience,
  onChange,
  resolution,
  checking,
  error,
  fieldErrors,
  disabled,
}: AudienceEditorProps) {
  const source = audience.recipient_source;
  const { data: fields } = useRecipientFields(eventId, source);
  const [advanced, setAdvanced] = useState(
    () => !!(audience.filter_expression || audience.address_expression || audience.name_expression),
  );
  const set = <K extends keyof EmailAudience>(key: K, value: EmailAudience[K]) =>
    onChange({ ...audience, [key]: value });
  const errors = audienceErrors(resolution, fieldErrors);
  const defaults = source === 'manual' ? null : DEFAULT_EXPRESSIONS[source];

  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Send to
        </Text>
        <SegmentedControl
          aria-label="Send to"
          data={SOURCE_OPTIONS}
          value={source}
          onChange={(value) =>
            // Conditions name the source's fields, so they don't carry over.
            onChange({
              ...audience,
              recipient_source: value as EmailRecipientSource,
              filter: { combinator: 'and', rules: [] },
            })
          }
          disabled={disabled}
          w="fit-content"
        />
      </Stack>

      {source === 'manual' ? (
        <Textarea
          label="Addresses"
          description="One per line: an address, or Name <address>. Lines starting with # are ignored."
          autosize
          minRows={4}
          value={audience.recipient_list}
          onChange={(e) => set('recipient_list', e.currentTarget.value)}
          error={errors.recipient_list}
          disabled={disabled}
        />
      ) : (
        <>
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Which ones
            </Text>
            {fields ? (
              <RecipientFilterBuilder
                value={audience.filter}
                onChange={(filter) => set('filter', filter)}
                fields={fields}
                everyone={SOURCE_NOUN[source]}
                error={errors.filter}
                disabled={disabled}
              />
            ) : (
              <Loader size="sm" aria-label="Loading fields" />
            )}
          </Stack>
          <Switch
            label="Include registrations that weren’t completed"
            checked={audience.include_incomplete}
            onChange={(e) => set('include_incomplete', e.currentTarget.checked)}
            disabled={disabled}
          />
          <UnstyledButton onClick={() => setAdvanced((open) => !open)} aria-expanded={advanced}>
            <Group gap={4}>
              {advanced ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              <Text size="sm" fw={500}>
                Advanced: Jinja expressions
              </Text>
            </Group>
          </UnstyledButton>
          <Collapse in={advanced}>
            <Stack gap="sm">
              <TextInput
                label="Also only those where (Jinja expression)"
                description={`Must also be true, alongside the conditions, e.g. ${FILTER_EXAMPLES[source]}`}
                placeholder={FILTER_EXAMPLES[source]}
                styles={CODE_INPUT}
                value={audience.filter_expression}
                onChange={(e) => set('filter_expression', e.currentTarget.value)}
                error={errors.filter_expression}
                disabled={disabled}
              />
              <Group grow align="flex-start">
                <TextInput
                  label="Address (Jinja expression)"
                  placeholder={defaults?.address}
                  description="Blank uses the placeholder."
                  styles={CODE_INPUT}
                  value={audience.address_expression}
                  onChange={(e) => set('address_expression', e.currentTarget.value)}
                  error={errors.address_expression}
                  disabled={disabled}
                />
                <TextInput
                  label="Name (Jinja expression)"
                  placeholder={defaults?.name || 'No name'}
                  description="Blank uses the placeholder."
                  styles={CODE_INPUT}
                  value={audience.name_expression}
                  onChange={(e) => set('name_expression', e.currentTarget.value)}
                  error={errors.name_expression}
                  disabled={disabled}
                />
              </Group>
            </Stack>
          </Collapse>
        </>
      )}

      {error && (
        <Alert color="red" variant="light" title="Couldn’t check the recipients">
          {error}
        </Alert>
      )}
      {resolution ? (
        <AudienceSummary resolution={resolution} checking={checking} />
      ) : (
        checking && <Loader size="sm" aria-label="Checking recipients" />
      )}
    </Stack>
  );
}

/** "N recipients, M skipped", with the lists behind a toggle. */
export function AudienceSummary({
  resolution,
  checking,
}: {
  resolution: AudienceResolution;
  checking?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { recipients, skipped } = resolution;
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text fw={600} aria-live="polite">
          {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'}
          {skipped.length ? `, ${skipped.length} skipped` : ''}
        </Text>
        {checking && <Loader size="xs" aria-label="Checking recipients" />}
        {(recipients.length > 0 || skipped.length > 0) && (
          <Anchor component="button" type="button" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Show'}
          </Anchor>
        )}
      </Group>
      {open && <AudienceTables resolution={resolution} />}
    </Stack>
  );
}

function AudienceTables({ resolution }: { resolution: AudienceResolution }) {
  const { recipients, skipped } = resolution;
  return (
    <Tabs defaultValue="recipients" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="recipients">Recipients</Tabs.Tab>
        <Tabs.Tab value="skipped" disabled={!skipped.length}>
          Skipped
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="recipients" pt="xs">
        <Table.ScrollContainer minWidth={480} mah={320}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>For</Table.Th>
                <Table.Th>Address</Table.Th>
                <Table.Th>Name</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recipients.map((r) => (
                <Table.Tr key={r.key}>
                  <Table.Td>
                    {r.label}{' '}
                    {r.already_sent && (
                      <Badge size="xs" variant="light" color="gray">
                        Already sent
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{r.email}</Table.Td>
                  <Table.Td>{r.name}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Tabs.Panel>
      <Tabs.Panel value="skipped" pt="xs">
        <SkippedTable skipped={resolution.skipped} />
      </Tabs.Panel>
    </Tabs>
  );
}

/** Who the audience leaves out, and why. */
export function SkippedTable({ skipped }: { skipped: AudienceResolution['skipped'] }) {
  return (
    <Table.ScrollContainer minWidth={480} mah={320}>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>For</Table.Th>
            <Table.Th>Why</Table.Th>
            <Table.Th>Detail</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {skipped.map((s, i) => (
            <Table.Tr key={`${s.label}-${i}`}>
              <Table.Td>{s.label}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={s.reason === 'filter_error' ? 'red' : 'gray'}>
                  {SKIP_REASONS[s.reason]}
                </Badge>
              </Table.Td>
              <Table.Td>{s.detail || s.email}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
