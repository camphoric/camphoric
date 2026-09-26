/**
 * Choose a group email's recipients without code (SPEC §8.9; §15 DR-45): match
 * all or any of a list of conditions, each a field → an operator → a value.
 * The fields come from the event's catalog (grouped, typed); each type offers
 * its own operators, and the value input follows the type — a number, a date,
 * one choice or several. The result is the rules JSON the server evaluates.
 */

import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconPlus, IconX } from '@tabler/icons-react';
import type {
  EmailFieldType,
  EmailFilter,
  EmailRecipientField,
  EmailRule,
  EmailRuleOp,
  EmailRuleValue,
} from 'api-types';
import { useMemo } from 'react';

interface OperatorDef {
  value: EmailRuleOp;
  label: string;
  /** Takes no value (is set, is true…). */
  noValue?: boolean;
  /** Takes several values. */
  multi?: boolean;
}

const SET: OperatorDef[] = [
  { value: 'is_set', label: 'is set', noValue: true },
  { value: 'is_not_set', label: 'isn’t set', noValue: true },
];

/** The operators each kind of field offers (the server's `rules.OPERATORS`). */
export const OPERATORS: Record<EmailFieldType, OperatorDef[]> = {
  string: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'doesn’t contain' },
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    ...SET,
  ],
  number: [
    { value: 'eq', label: '=' },
    { value: 'ne', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    ...SET,
  ],
  boolean: [
    { value: 'is_true', label: 'is true', noValue: true },
    { value: 'is_false', label: 'is false', noValue: true },
  ],
  enum: [
    { value: 'is', label: 'is' },
    { value: 'is_not', label: 'is not' },
    { value: 'any_of', label: 'is any of', multi: true },
    ...SET,
  ],
  date: [
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is after' },
    { value: 'on', label: 'is on' },
    ...SET,
  ],
  list: [
    { value: 'contains', label: 'includes' },
    { value: 'any_of', label: 'includes any of', multi: true },
    ...SET,
  ],
};

export const EMPTY_FILTER: EmailFilter = { combinator: 'and', rules: [] };

function operator(type: EmailFieldType | undefined, op: EmailRuleOp | undefined) {
  return OPERATORS[type ?? 'string'].find((o) => o.value === op);
}

function hasValue(value: EmailRuleValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== '';
}

/**
 * Whether a rule is finished: a field, an operator, and a value when the
 * operator takes one. (Operators the builder doesn't know are left to the server.)
 */
export function ruleComplete(rule: EmailRule, fields?: EmailRecipientField[]) {
  if (!rule.field || !rule.op) return false;
  const type = fields?.find((f) => f.key === rule.field)?.type;
  const def = operator(type, rule.op) ?? operator('string', rule.op);
  return def?.noValue || hasValue(rule.value);
}

/** The filter with only its finished rules (what a live recipient count can use). */
export function completeFilter(filter: EmailFilter, fields?: EmailRecipientField[]): EmailFilter {
  return {
    combinator: filter.combinator ?? 'and',
    rules: (filter.rules ?? []).filter((rule) => ruleComplete(rule, fields)),
  };
}

/** How many rules still need a field or a value. */
export function unfinishedRules(filter: EmailFilter, fields?: EmailRecipientField[]) {
  return (filter.rules ?? []).filter((rule) => !ruleComplete(rule, fields)).length;
}

interface RecipientFilterBuilderProps {
  value: EmailFilter;
  onChange: (filter: EmailFilter) => void;
  /** The event's fields (GET …/email/recipient-fields). */
  fields: EmailRecipientField[];
  /** Who no conditions means, e.g. "registrations" — "every registration is included". */
  everyone?: string;
  /** A problem with the filter as a whole (from the server). */
  error?: string | null;
  disabled?: boolean;
}

export function RecipientFilterBuilder({
  value,
  onChange,
  fields,
  everyone = 'recipient',
  error,
  disabled,
}: RecipientFilterBuilderProps) {
  const combinator = value.combinator ?? 'and';
  const rules = useMemo(() => value.rules ?? [], [value.rules]);
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);

  const fieldData = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const f of fields) {
      if (!groups.has(f.group)) groups.set(f.group, []);
      groups.get(f.group)!.push({ value: f.key, label: f.label });
    }
    // A saved rule on a field the event no longer has stays visible (and fails on the server).
    const unknown = rules
      .map((r) => r.field)
      .filter((key) => key && !byKey.has(key))
      .map((key) => ({ value: key, label: `${key} (not found)` }));
    const data = [...groups].map(([group, items]) => ({ group, items }));
    return unknown.length ? [...data, { group: 'Not found', items: unknown }] : data;
  }, [fields, rules, byKey]);

  const setRules = (next: EmailRule[]) => onChange({ combinator, rules: next });
  const updateRule = (index: number, patch: Partial<EmailRule>) =>
    setRules(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const chooseField = (index: number, key: string | null) => {
    const type = key ? byKey.get(key)?.type : undefined;
    updateRule(index, { field: key ?? '', op: OPERATORS[type ?? 'string'][0].value, value: null });
  };

  const chooseOperator = (index: number, op: EmailRuleOp, rule: EmailRule) => {
    const type = byKey.get(rule.field)?.type;
    const before = operator(type, rule.op);
    const after = operator(type, op);
    // Keep the value when the new operator takes the same kind of value.
    const keep =
      before && after && !after.noValue && !before.noValue && !!before.multi === !!after.multi;
    updateRule(index, { op, value: keep ? rule.value : null });
  };

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Text size="sm">Match</Text>
        <SegmentedControl
          size="xs"
          aria-label="Match"
          data={[
            { value: 'and', label: 'all' },
            { value: 'or', label: 'any' },
          ]}
          value={combinator}
          onChange={(next) => onChange({ combinator: next as 'and' | 'or', rules })}
          disabled={disabled}
        />
        <Text size="sm">of these conditions</Text>
      </Group>

      {rules.length === 0 && (
        <Text size="sm" c="dimmed">
          No conditions: every {everyone} is included.
        </Text>
      )}

      {rules.map((rule, index) => {
        const field = byKey.get(rule.field);
        const type = field?.type ?? 'string';
        const def = operator(type, rule.op);
        return (
          <Group
            key={index}
            gap="xs"
            align="flex-start"
            wrap="wrap"
            role="group"
            aria-label={`Condition ${index + 1}`}
          >
            <Select
              aria-label="Field"
              placeholder="Field"
              data={fieldData}
              searchable
              value={rule.field || null}
              onChange={(key) => chooseField(index, key)}
              style={{ flex: '2 1 200px' }}
              error={rule.field && !field ? 'This field isn’t in the event' : undefined}
              disabled={disabled}
            />
            <Select
              aria-label="Operator"
              placeholder="Operator"
              data={OPERATORS[type].map(({ value: v, label }) => ({ value: v, label }))}
              value={def ? rule.op : null}
              onChange={(op) => op && chooseOperator(index, op as EmailRuleOp, rule)}
              allowDeselect={false}
              style={{ flex: '1 1 130px' }}
              disabled={disabled || !rule.field}
            />
            {def && !def.noValue && (
              <div style={{ flex: '2 1 180px' }}>
                <ValueInput
                  field={field}
                  type={type}
                  multi={!!def.multi}
                  value={rule.value}
                  onChange={(v) => updateRule(index, { value: v })}
                  disabled={disabled}
                />
              </div>
            )}
            <ActionIcon
              variant="subtle"
              color="red"
              mt={4}
              onClick={() => setRules(rules.filter((_, i) => i !== index))}
              aria-label={`Remove condition ${index + 1}`}
              disabled={disabled}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        );
      })}

      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}

      <Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setRules([...rules, { field: '', op: 'contains', value: null }])}
          disabled={disabled}
        >
          Add condition
        </Button>
      </Group>
    </Stack>
  );
}

interface ValueInputProps {
  field?: EmailRecipientField;
  type: EmailFieldType;
  multi: boolean;
  value: EmailRuleValue | undefined;
  onChange: (value: EmailRuleValue) => void;
  disabled?: boolean;
}

/** The value box for a condition, by the field's type and the operator. */
function ValueInput({ field, type, multi, value, onChange, disabled }: ValueInputProps) {
  const common = { 'aria-label': 'Value', disabled };
  const options = field?.options?.map((o) => ({ value: String(o.value), label: o.label }));
  const list = Array.isArray(value) ? value : hasValue(value) ? [String(value)] : [];
  const single = Array.isArray(value) ? (value[0] ?? '') : value == null ? '' : String(value);

  if (type === 'number') {
    return (
      <NumberInput
        {...common}
        placeholder="Number"
        value={typeof value === 'number' ? value : single}
        onChange={(v) => onChange(v === '' ? null : typeof v === 'number' ? v : Number(v))}
      />
    );
  }
  if (type === 'date') {
    return (
      <DateInput
        {...common}
        placeholder="Date"
        valueFormat="YYYY-MM-DD"
        value={single || null}
        onChange={(v) => onChange(v ? String(v).slice(0, 10) : null)}
        clearable
      />
    );
  }
  if (multi) {
    return options ? (
      <MultiSelect
        {...common}
        placeholder="Choose"
        data={options}
        searchable
        value={list}
        onChange={onChange}
      />
    ) : (
      <TagsInput {...common} placeholder="Type, then Enter" value={list} onChange={onChange} />
    );
  }
  if (options) {
    return (
      <Select
        {...common}
        placeholder="Choose"
        data={options}
        searchable
        value={single || null}
        onChange={(v) => onChange(v)}
      />
    );
  }
  return (
    <TextInput
      {...common}
      placeholder="Text"
      value={single}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
