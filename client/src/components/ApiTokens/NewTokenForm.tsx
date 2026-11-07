/**
 * Make a personal access token for yourself (SPEC §6; #965): its name, when it
 * expires and whether it may only read. The expiry is always chosen — a number
 * of days, a date and time, or never (only when the server has no cap) — with
 * none chosen at first; see `tokenExpiry`. The server's objections show under
 * their fields.
 */

import { Alert, Button, Checkbox, Select, Stack, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import type { NewTokenRequest } from 'api-types';
import { FormActions } from 'components/FormActions';
import { useState } from 'react';
import { localDateTimeToIso } from 'utils/dates';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

import {
  expiresAtFor,
  type ExpiryChoice,
  expiryOptions,
  expiryProblem,
  latestExpiry,
} from './tokenExpiry';

/** The longest name the server takes. */
export const TOKEN_NAME_MAX_LENGTH = 100;

export interface NewTokenFormProps {
  /** The most days a token may last (`api_token_max_days`); null for no cap. */
  maxDays: number | null;
  saving?: boolean;
  /** The last save's error: field errors show under their fields. */
  error?: unknown;
  onSubmit: (values: NewTokenRequest) => void;
  onCancel: () => void;
}

export function NewTokenForm({ maxDays, saving, error, onSubmit, onCancel }: NewTokenFormProps) {
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<ExpiryChoice | null>(null);
  // The picker's value: a clock time in the browser's zone (`YYYY-MM-DD HH:mm:ss`).
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const errors = apiFieldErrors(error);
  const otherError = error && !Object.keys(errors).length ? apiErrorMessage(error) : null;

  const now = new Date();
  const pickedIso = pickedTime ? localDateTimeToIso(pickedTime) : null;
  const dateProblem =
    choice === 'date' && pickedIso ? expiryProblem(pickedIso, maxDays, now) : null;
  const ready =
    name.trim() !== '' &&
    choice !== null &&
    (choice !== 'date' || (pickedIso !== null && dateProblem === null));

  const submitToken = () => {
    if (!ready) return;
    onSubmit({
      name: name.trim(),
      expires_at: expiresAtFor(choice, pickedIso, maxDays, new Date()),
      read_only: readOnly,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitToken();
      }}
    >
      <Stack>
        <TextInput
          label="Name"
          description="What it’s for, such as the script that uses it."
          withAsterisk
          maxLength={TOKEN_NAME_MAX_LENGTH}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={errors.name}
        />
        <Select
          label="Expires"
          description={
            maxDays === null
              ? 'A token that never expires still ends if it’s revoked or your password changes.'
              : `A token may last at most ${maxDays} ${maxDays === 1 ? 'day' : 'days'} here.`
          }
          withAsterisk
          placeholder="Choose when it expires"
          data={expiryOptions(maxDays)}
          value={choice}
          onChange={setChoice}
          allowDeselect={false}
          // A date and time chosen goes below; one wrong for the server shows there too.
          error={choice === 'date' ? undefined : errors.expires_at}
        />
        {choice === 'date' && (
          <DateTimePicker
            label="Expires at"
            withAsterisk
            placeholder="Date and time"
            valueFormat="MM/DD/YYYY h:mm A"
            value={pickedTime}
            onChange={setPickedTime}
            minDate={now}
            maxDate={latestExpiry(maxDays, now) ?? undefined}
            error={dateProblem ?? errors.expires_at}
          />
        )}
        <Checkbox
          label="Read-only"
          description="It can look at anything you can, but change nothing."
          checked={readOnly}
          onChange={(e) => setReadOnly(e.currentTarget.checked)}
          error={errors.read_only}
        />
        {otherError && (
          <Alert color="red" variant="light">
            {otherError}
          </Alert>
        )}
        <FormActions>
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} loading={saving}>
            Create token
          </Button>
        </FormActions>
      </Stack>
    </form>
  );
}
