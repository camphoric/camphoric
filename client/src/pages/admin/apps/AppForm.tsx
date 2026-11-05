/**
 * Register or edit an app that uses OAuth (SPEC §8.10; §15 DR-146): its name,
 * which people see when asked to approve it, and its redirect URIs, one per
 * line — where it may be sent back after the consent page, each matched
 * exactly (https only, except where the server allows http for development).
 */

import { Alert, Button, Stack, Textarea, TextInput } from '@mantine/core';
import type { ApiApplication, ApplicationRequest } from 'api-types';
import { FormActions } from 'components/FormActions';
import { useState } from 'react';
import { apiErrorMessage, apiFieldErrors } from 'utils/fetch';

export interface AppFormProps {
  /** Omitted for a new app. */
  app?: ApiApplication;
  saving?: boolean;
  /** The last save's error: field errors show under their fields. */
  error?: unknown;
  onSubmit: (values: ApplicationRequest) => void;
  onCancel: () => void;
}

/** The redirect URIs typed, one per line, without blank lines. */
export function redirectUris(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function AppForm({ app, saving, error, onSubmit, onCancel }: AppFormProps) {
  const [name, setName] = useState(app?.name ?? '');
  const [uris, setUris] = useState((app?.redirect_uris ?? []).join('\n'));
  const errors = apiFieldErrors(error);
  const otherError = error && !Object.keys(errors).length ? apiErrorMessage(error) : null;
  const ready = name.trim() !== '' && redirectUris(uris).length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ name: name.trim(), redirect_uris: redirectUris(uris) });
      }}
    >
      <Stack>
        <TextInput
          label="Name"
          description="What people see when they’re asked to connect it to their account."
          withAsterisk
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={errors.name}
        />
        <Textarea
          label="Redirect URIs"
          description="Where the app is sent back after someone approves it, one per line. Each must match exactly what the app sends."
          withAsterisk
          autosize
          minRows={2}
          placeholder="https://admin-tool.example.org/oauth/callback"
          value={uris}
          onChange={(e) => setUris(e.currentTarget.value)}
          error={errors.redirect_uris}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
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
            {app ? 'Save' : 'Register app'}
          </Button>
        </FormActions>
      </Stack>
    </form>
  );
}
