/**
 * The event's cancellation fee (SPEC §8.3; §15, DR-170): none, or JsonLogic the
 * server works out for a camper as of the day they're cancelled — a fixed
 * amount, a percent of their total, tiers by how long before the event, or
 * anything else the logic can say. What it comes to is what deleting a camper
 * offers to keep, to start with; the registrar can change it each time (§8.5).
 *
 * The text is kept while it isn't JsonLogic the server takes (the error shows,
 * and `onErrorChange` says so, for the page to hold Save back); only a fee that
 * is reaches `onChange`. A value changed from outside replaces the text.
 */

import { Alert, Button, Group, Input, Stack, Switch } from '@mantine/core';
import { JsonEditor } from 'components/JsonEditor';
import { useEffect, useState } from 'react';

/** Ready-made fees, to start from. */
export const CANCELLATION_FEE_EXAMPLES: { label: string; logic: unknown }[] = [
  { label: '$50', logic: 50 },
  { label: '10% of the camper’s total', logic: { '*': [{ var: 'total' }, 0.1] } },
  {
    label: '10%, or 50% within 30 days',
    logic: {
      if: [
        { '>=': [{ var: 'days_before_start' }, 30] },
        { '*': [{ var: 'total' }, 0.1] },
        { '*': [{ var: 'total' }, 0.5] },
      ],
    },
  },
  {
    label: '$150, and PayPal’s fees once',
    logic: { '+': [150, { if: [{ var: 'first_cancellation' }, { var: 'paypal_fees' }, 0] }] },
  },
];

const DEFAULT_LOGIC = CANCELLATION_FEE_EXAMPLES[1].logic;

const pretty = (logic: unknown) => JSON.stringify(logic, null, 2);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The text as JsonLogic the server takes (§5): an object with one operator, or a number. */
export function parseFee(text: string): { logic: unknown } | { error: string } {
  let logic: unknown;
  try {
    logic = JSON.parse(text) as unknown;
  } catch (error) {
    return { error: `Invalid JSON: ${(error as Error).message}` };
  }
  if (typeof logic === 'number' && Number.isFinite(logic)) return { logic };
  if (logic && typeof logic === 'object' && !Array.isArray(logic)) {
    if (Object.keys(logic).length === 1) return { logic };
    return { error: 'JsonLogic has one operator at the top, e.g. {"*": […]}.' };
  }
  return { error: 'JsonLogic is an object or a number. To offer no fee, switch it off.' };
}

interface CancellationFeeInputProps {
  /** JsonLogic, or null for none. */
  value: unknown;
  onChange: (value: unknown) => void;
  /**
   * Told whether the text is JsonLogic the server takes: while it isn't, the
   * value stays as it last was, and the page shouldn't save (§8.3).
   */
  onErrorChange?: (error: string | null) => void;
}

export function CancellationFeeInput({
  value,
  onChange,
  onErrorChange,
}: CancellationFeeInputProps) {
  const on = value !== null && value !== undefined;
  const [text, setText] = useState(() => (on ? pretty(value) : ''));
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(value);

  // A value changed from outside — someone else's save followed, a conflict
  // discarded — replaces the text, unless the text already says it (§9.8).
  if (!same(shown, value)) {
    setShown(value);
    const parsed = parseFee(text);
    if (on && !('logic' in parsed && same(parsed.logic, value))) {
      setText(pretty(value));
      setError(null);
    }
  }

  // The page holds Save back while the text isn't a fee.
  useEffect(() => onErrorChange?.(on ? error : null), [on, error, onErrorChange]);

  const edit = (next: string) => {
    setText(next);
    const parsed = parseFee(next);
    if ('error' in parsed) {
      setError(parsed.error);
    } else {
      setError(null);
      if (!same(parsed.logic, value)) onChange(parsed.logic);
    }
  };
  const use = (logic: unknown) => edit(pretty(logic));

  return (
    <Stack gap="xs">
      <Switch
        label="Offer a cancellation fee"
        description="What deleting a camper offers to keep, to start with. The registrar can change it each time."
        checked={on}
        onChange={(e) => {
          if (e.currentTarget.checked) use(DEFAULT_LOGIC);
          else {
            setError(null);
            onChange(null);
          }
        }}
      />
      {on && (
        <Input.Wrapper
          label="Cancellation fee"
          description='JsonLogic for the fee, worked out for the camper on the day they’re cancelled. It sees the camper (camper.…), their price lines (e.g. {"var": "total"}), registration, pricing, date, days_before_start, paypal_fees (what PayPal kept on the registration’s payments) and first_cancellation (no fee kept on the registration yet). Below $0 is $0.'
        >
          <Stack gap="xs" mt="xs">
            <Group gap="xs">
              {CANCELLATION_FEE_EXAMPLES.map((example) => (
                <Button
                  key={example.label}
                  size="compact-xs"
                  variant="light"
                  onClick={() => use(example.logic)}
                >
                  {example.label}
                </Button>
              ))}
            </Group>
            <JsonEditor value={text} onChange={edit} height={160} path="cancellation-fee.json" />
            {error && (
              <Alert color="red" variant="light" title="Not a fee yet">
                {error} It can’t be saved until it is.
              </Alert>
            )}
          </Stack>
        </Input.Wrapper>
      )}
    </Stack>
  );
}
