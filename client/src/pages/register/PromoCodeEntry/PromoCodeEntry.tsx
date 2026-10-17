/**
 * The promo code field shown above "Continue to payment" (SPEC §7.1; §15,
 * DR-67): the registrant types a code and applies it, which checks it with the
 * server; an applied code shows its label and can be removed. Presentational —
 * `usePromoCodeEntry` holds the state and does the checking.
 */

import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import type { AppliedPromo } from 'api-types';
import type { KeyboardEvent, Ref } from 'react';

import { isSameCode } from './usePromoCodeEntry';

export interface PromoCodeEntryProps {
  value: string;
  /** The code applied, if any; it's shown as applied while the field still holds it. */
  applied: AppliedPromo | null;
  error?: string;
  /** Whether the code is being checked. */
  checking?: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

export function PromoCodeEntry({
  value,
  applied,
  error,
  checking = false,
  onChange,
  onApply,
  onRemove,
  inputRef,
}: PromoCodeEntryProps) {
  const isApplied = applied !== null && isSameCode(value, applied.code);

  // The field sits inside the registration form: Enter applies the code
  // rather than submitting the form.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!isApplied) onApply();
  };

  return (
    <Stack gap={4} maw={420}>
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <TextInput
          ref={inputRef}
          label="Promo code"
          value={value}
          error={Boolean(error)}
          aria-describedby={error ? 'promo-code-error' : undefined}
          autoComplete="off"
          style={{ flex: 1 }}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        {isApplied ? (
          <Button type="button" variant="default" onClick={onRemove}>
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            variant="light"
            loading={checking}
            disabled={!value.trim()}
            onClick={onApply}
          >
            Apply
          </Button>
        )}
      </Group>
      {error && (
        <Text id="promo-code-error" size="sm" c="red" role="alert">
          {error}
        </Text>
      )}
      {isApplied && (
        <Text size="sm" c="green">
          Applied: {applied.label}
        </Text>
      )}
    </Stack>
  );
}
