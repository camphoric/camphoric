/**
 * Choose who a bulk email goes to (SPEC §8.9): typed addresses, or the event's
 * registrations or campers narrowed by a Jinja filter, with Jinja expressions
 * for each one's address and name. Shows who the list reaches — and who it
 * skips, and why — as the criteria change.
 */

import {
  Alert,
  Badge,
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
} from '@mantine/core';
import type {
  BulkRecipientCriteria,
  BulkRecipientKind,
  BulkRecipientResolution,
  BulkRecipientSkipped,
} from 'api-types';

/** Expressions are code: monospace in the box, ordinary label and description. */
const CODE_INPUT = { input: { fontFamily: 'var(--mantine-font-family-monospace)' } };

const KIND_OPTIONS: { value: BulkRecipientKind; label: string }[] = [
  { value: 'registrations', label: 'Registrations' },
  { value: 'campers', label: 'Campers' },
  { value: 'manual', label: 'Listed addresses' },
];

/** The server's defaults when an expression is left blank (bulk.py). */
export const DEFAULT_EXPRESSIONS: Record<
  'registrations' | 'campers',
  { address: string; name: string }
> = {
  registrations: { address: 'registration.registrant_email', name: '' },
  campers: {
    address: 'camper.attributes.email or registration.registrant_email',
    name: "[camper.attributes.first_name, camper.attributes.last_name] | select | join(' ')",
  },
};

const FILTER_EXAMPLES: Record<'registrations' | 'campers', string> = {
  registrations: 'registration.balance > 0',
  campers: "camper.lodging and camper.lodging.full_name.startswith('Cabins')",
};

export const SKIP_REASONS: Record<BulkRecipientSkipped['reason'], string> = {
  no_address: 'No address',
  invalid: 'Not a valid address',
  duplicate: 'Duplicate address',
  filter_error: 'Expression failed',
};

/** Blank criteria for a new task. */
export const EMPTY_CRITERIA: BulkRecipientCriteria = {
  recipient_kind: 'registrations',
  recipient_list: '',
  recipient_filter: '',
  address_expression: '',
  name_expression: '',
  include_incomplete: false,
};

interface RecipientSelectorProps {
  criteria: BulkRecipientCriteria;
  onChange: (criteria: BulkRecipientCriteria) => void;
  /** Who the criteria reach (from the recipient preview). */
  resolution?: BulkRecipientResolution;
  checking?: boolean;
  /** The preview request failed. */
  error?: string | null;
  disabled?: boolean;
}

function fieldError(resolution: BulkRecipientResolution | undefined, field: string) {
  const problem = resolution?.diagnostics.find((d) => d.field === field);
  return problem ? problem.message : null;
}

export function RecipientSelector({
  criteria,
  onChange,
  resolution,
  checking,
  error,
  disabled,
}: RecipientSelectorProps) {
  const set = <K extends keyof BulkRecipientCriteria>(key: K, value: BulkRecipientCriteria[K]) =>
    onChange({ ...criteria, [key]: value });
  const kind = criteria.recipient_kind;
  const defaults = kind === 'manual' ? null : DEFAULT_EXPRESSIONS[kind];

  return (
    <Stack gap="sm">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Send to
        </Text>
        <SegmentedControl
          aria-label="Send to"
          data={KIND_OPTIONS}
          value={kind}
          onChange={(value) => set('recipient_kind', value as BulkRecipientKind)}
          disabled={disabled}
          w="fit-content"
        />
      </Stack>

      {kind === 'manual' ? (
        <Textarea
          label="Addresses"
          description="One per line: an address, or Name <address>. Lines starting with # are ignored."
          autosize
          minRows={4}
          value={criteria.recipient_list}
          onChange={(e) => set('recipient_list', e.currentTarget.value)}
          disabled={disabled}
        />
      ) : (
        <>
          <TextInput
            label="Which ones (Jinja expression)"
            description={`Leave blank for all. Uses the email's variables, e.g. ${FILTER_EXAMPLES[kind]}`}
            placeholder={FILTER_EXAMPLES[kind]}
            styles={CODE_INPUT}
            value={criteria.recipient_filter}
            onChange={(e) => set('recipient_filter', e.currentTarget.value)}
            error={fieldError(resolution, 'recipient_filter')}
            disabled={disabled}
          />
          <Group grow align="flex-start">
            <TextInput
              label="Address (Jinja expression)"
              placeholder={defaults?.address}
              description="Blank uses the placeholder."
              styles={CODE_INPUT}
              value={criteria.address_expression}
              onChange={(e) => set('address_expression', e.currentTarget.value)}
              error={fieldError(resolution, 'address_expression')}
              disabled={disabled}
            />
            <TextInput
              label="Name (Jinja expression)"
              placeholder={defaults?.name || 'No name'}
              description="Blank uses the placeholder."
              styles={CODE_INPUT}
              value={criteria.name_expression}
              onChange={(e) => set('name_expression', e.currentTarget.value)}
              error={fieldError(resolution, 'name_expression')}
              disabled={disabled}
            />
          </Group>
          <Switch
            label="Include registrations that weren’t completed"
            checked={criteria.include_incomplete}
            onChange={(e) => set('include_incomplete', e.currentTarget.checked)}
            disabled={disabled}
          />
        </>
      )}

      {error && (
        <Alert color="red" variant="light" title="Couldn’t check the recipients">
          {error}
        </Alert>
      )}
      {resolution && <ResolutionTables resolution={resolution} checking={checking} />}
      {!resolution && checking && <Loader size="sm" aria-label="Checking recipients" />}
    </Stack>
  );
}

export function ResolutionTables({
  resolution,
  checking,
}: {
  resolution: BulkRecipientResolution;
  checking?: boolean;
}) {
  const { recipients, skipped } = resolution;
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text fw={600} aria-live="polite">
          {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'}
          {skipped.length ? `, ${skipped.length} skipped` : ''}
        </Text>
        {checking && <Loader size="xs" aria-label="Checking recipients" />}
      </Group>
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
                  <Table.Tr key={r.email}>
                    <Table.Td>{r.label}</Table.Td>
                    <Table.Td>{r.email}</Table.Td>
                    <Table.Td>{r.name}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>
        <Tabs.Panel value="skipped" pt="xs">
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
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
