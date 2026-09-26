/**
 * Add or edit an email account (SPEC §8.8): the SMTP server an event sends
 * through, its credentials, and its sending limits. The password is
 * write-only — the server stores it encrypted and never returns it — so when
 * editing, a blank password keeps the stored one, unless it can no longer be
 * read (the encryption key changed) and must be entered again.
 */

import {
  Alert,
  Button,
  Group,
  NumberInput,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import type { ApiEmailAccount, EmailAccountSecurity } from 'api-types';

export const SMTP_BACKEND = 'django.core.mail.backends.smtp.EmailBackend';
const CONSOLE_BACKEND = 'django.core.mail.backends.console.EmailBackend';

const DEFAULT_PORT: Record<EmailAccountSecurity, number> = { starttls: 587, ssl: 465, none: 25 };

/** What the form saves: an account's fields (the password only when it's changed). */
export type EmailAccountBody = Omit<
  ApiEmailAccount,
  'id' | 'password_status' | 'created_at' | 'updated_at' | 'deleted_at'
>;

interface Values {
  name: string;
  backend: string;
  host: string;
  port: number | string;
  security: EmailAccountSecurity;
  timeout: number | string;
  username: string;
  password: string;
  max_per_minute: number | string;
  max_per_day: number | string;
  default_reply_to: string;
}

interface EmailAccountFormProps {
  organizationId: number;
  /** The account being edited; omit to add one. */
  account?: ApiEmailAccount;
  onSubmit: (body: EmailAccountBody) => void;
  onCancel: () => void;
  saving?: boolean;
}

const limit = (value: number | string) => (value === '' ? null : Number(value));

export function EmailAccountForm({
  organizationId,
  account,
  onSubmit,
  onCancel,
  saving,
}: EmailAccountFormProps) {
  const unreadable = account?.password_status === 'unreadable';
  const form = useForm<Values>({
    initialValues: {
      name: account?.name ?? '',
      backend: account?.backend ?? SMTP_BACKEND,
      host: account?.host ?? '',
      port: account?.port ?? DEFAULT_PORT.starttls,
      security: account?.security ?? 'starttls',
      timeout: account?.timeout ?? 30,
      username: account?.username ?? '',
      password: '',
      max_per_minute: account?.max_per_minute ?? '',
      max_per_day: account?.max_per_day ?? '',
      default_reply_to: account?.default_reply_to ?? '',
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Give the account a name'),
      host: (value, values) =>
        values.backend !== SMTP_BACKEND || value.trim() ? null : 'Enter the mail server',
      port: (value) =>
        Number(value) >= 1 && Number(value) <= 65535 ? null : 'Enter a port from 1 to 65535',
      password: (value) => (unreadable && !value ? 'Enter the password again' : null),
      default_reply_to: (value) =>
        !value || /^\S+@\S+\.\S+$/.test(value) ? null : 'Enter an email address',
    },
  });
  const smtp = form.values.backend === SMTP_BACKEND;

  const setSecurity = (security: EmailAccountSecurity) => {
    // Move the port along with the security, unless it was set to something unusual.
    const usual = Object.values(DEFAULT_PORT).includes(Number(form.values.port));
    form.setValues({ security, ...(usual ? { port: DEFAULT_PORT[security] } : {}) });
  };

  const submit = form.onSubmit((values) => {
    const body: EmailAccountBody = {
      organization: organizationId,
      name: values.name.trim(),
      backend: values.backend,
      host: values.host.trim(),
      port: Number(values.port),
      security: values.security,
      timeout: Number(values.timeout) || 30,
      username: values.username.trim(),
      max_per_minute: limit(values.max_per_minute),
      max_per_day: limit(values.max_per_day),
      default_reply_to: values.default_reply_to.trim(),
    };
    if (values.password) body.password = values.password;
    onSubmit(body);
  });

  const passwordHelp = !account
    ? 'Stored encrypted; it can’t be read back.'
    : account.password_status === 'set'
      ? 'Leave blank to keep the stored password.'
      : undefined;

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="Name" withAsterisk {...form.getInputProps('name')} />
        <Select
          label="Sends"
          data={[
            { value: SMTP_BACKEND, label: 'Through a mail server (SMTP)' },
            { value: CONSOLE_BACKEND, label: 'To the server’s log (for testing)' },
          ]}
          allowDeselect={false}
          {...form.getInputProps('backend')}
        />

        {smtp && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Mail server"
                placeholder="smtp.gmail.com"
                withAsterisk
                {...form.getInputProps('host')}
              />
              <NumberInput label="Port" min={1} max={65535} {...form.getInputProps('port')} />
            </SimpleGrid>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Security
              </Text>
              <SegmentedControl
                data={[
                  { value: 'starttls', label: 'STARTTLS' },
                  { value: 'ssl', label: 'SSL/TLS' },
                  { value: 'none', label: 'None' },
                ]}
                value={form.values.security}
                onChange={(value) => setSecurity(value as EmailAccountSecurity)}
                aria-label="Security"
              />
            </Stack>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Username"
                description="Often the account's email address"
                {...form.getInputProps('username')}
              />
              <PasswordInput
                label="Password"
                description={passwordHelp}
                placeholder={account?.password_status === 'set' ? '••••••••' : undefined}
                autoComplete="new-password"
                {...form.getInputProps('password')}
              />
            </SimpleGrid>
            {unreadable && (
              <Alert color="red" variant="light" title="The stored password can’t be read">
                The server’s encryption key has changed since it was saved. Enter the password
                again; until then this account can’t send.
              </Alert>
            )}
            <NumberInput
              label="Timeout (seconds)"
              min={1}
              max={300}
              w={200}
              {...form.getInputProps('timeout')}
            />
          </>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Most messages a minute"
            description="Blank: no limit"
            min={1}
            {...form.getInputProps('max_per_minute')}
          />
          <NumberInput
            label="Most messages a day"
            description="Gmail allows about 500 (personal) or 2,000 (Workspace)"
            min={1}
            {...form.getInputProps('max_per_day')}
          />
        </SimpleGrid>
        <TextInput
          label="Reply-To"
          description="Where replies go, when not to the sending address"
          placeholder="office@camp.org"
          {...form.getInputProps('default_reply_to')}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {account ? 'Save' : 'Add account'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
