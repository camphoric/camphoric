/**
 * Validation messages (SPEC §8.8, DR-34): the event's own wording for
 * registration-form validation errors, stored on the event as
 * `registration_error_messages` ({ field path: { error type: message } }).
 *
 * Admins can list, add, edit and remove messages (each one a field, an error
 * type and a message), see the built-in messages that apply when no rule
 * matches, or edit the whole map as JSON. Changes are saved together with Save.
 * Field choices come from the registration form's full schema as registrants
 * receive it, so conditional and server-built fields (lodging) are included.
 */

import { Accordion, Alert, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { IconPlus } from '@tabler/icons-react';
import type { ApiEvent, RegistrationErrorMessages } from 'api-types';
import {
  BUILT_IN_MESSAGES,
  collectFieldPaths,
  type ErrorMessageRule,
  type FieldPathInfo,
  KEYWORD_LABELS,
  removeRule,
  rulesToList,
  setRule,
  validateRules,
} from 'components/form';
import { JsonEditor } from 'components/JsonEditor';
import { useMemo, useState } from 'react';
import { eventHooks } from 'store/entities';
import { useRegistrationFormSchema } from 'store/registrationApi';

import { ErrorMessageRuleForm, fieldTitle } from './ErrorMessageRuleForm';

const keywordLabel = (keyword: string) =>
  (KEYWORD_LABELS as Record<string, string>)[keyword] ?? keyword;

export function ErrorMessagesSettings({ event }: { event: ApiEvent }) {
  const update = eventHooks.useUpdate();
  const { data: config } = useRegistrationFormSchema(String(event.id));

  const fieldMap = useMemo(
    () =>
      config
        ? collectFieldPaths(config.dataSchema as RJSFSchema, config.uiSchema as UiSchema)
        : new Map<string, FieldPathInfo>(),
    [config],
  );
  const fields = useMemo(() => [...fieldMap.values()], [fieldMap]);

  const [rules, setRules] = useState<RegistrationErrorMessages>(
    () => event.registration_error_messages ?? {},
  );
  const [dirty, setDirty] = useState(false);
  const [json, setJson] = useState<string | undefined>(); // defined while editing as JSON
  const [form, setForm] = useState<{ open: boolean; rule?: ErrorMessageRule }>({ open: false });

  const change = (next: RegistrationErrorMessages) => {
    setRules(next);
    setDirty(true);
  };

  // In JSON mode the text is the source of truth until it parses.
  const jsonParse = useMemo(() => {
    if (json === undefined) return undefined;
    try {
      return { value: JSON.parse(json) as unknown };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [json]);

  const problems = validateRules(
    jsonParse && 'value' in jsonParse ? jsonParse.value : rules,
    config ? new Set(fieldMap.keys()) : undefined,
  );
  const blocked = Boolean(jsonParse?.error) || problems.errors.length > 0;

  const editJson = (text: string) => {
    setJson(text);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (validateRules(parsed).errors.length === 0) {
        setRules(parsed as RegistrationErrorMessages);
      }
    } catch {
      // Shown via jsonParse; keep the last valid rules.
    }
    setDirty(true);
  };

  const save = () =>
    update.mutate(
      { id: event.id, registration_error_messages: rules },
      {
        onSuccess: () => {
          setDirty(false);
          notifications.show({ color: 'green', message: 'Validation messages saved' });
        },
      },
    );

  const confirmDelete = (rule: ErrorMessageRule) =>
    modals.openConfirmModal({
      title: 'Delete validation message',
      children: (
        <Text size="sm">
          Delete the message for “{fieldTitle(rule.path, fieldMap)}” ({keywordLabel(rule.keyword)})?
          The built-in message will be used instead.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => change(removeRule(rules, rule)),
    });

  const list = rulesToList(rules);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Validation messages</Title>
        <Group gap="xs">
          {json === undefined ? (
            <>
              <Button
                variant="light"
                size="compact-sm"
                leftSection={<IconPlus size={14} />}
                onClick={() => setForm({ open: true, rule: undefined })}
              >
                Add message
              </Button>
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => setJson(JSON.stringify(rules, null, 2))}
              >
                Edit as JSON
              </Button>
            </>
          ) : (
            <Button
              variant="subtle"
              size="compact-sm"
              disabled={blocked}
              onClick={() => setJson(undefined)}
            >
              Back to list
            </Button>
          )}
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Your own wording for the registration form's validation errors — for example, telling
        registrants who picked RV Camping to choose their RV length. Messages also apply in the
        admin camper and registration forms.
      </Text>

      {jsonParse?.error && (
        <Alert color="red" title="Invalid JSON">
          {jsonParse.error}
        </Alert>
      )}
      {problems.errors.length > 0 && (
        <Alert color="red" title="Fix before saving">
          {problems.errors.map((problem) => (
            <Text key={problem} size="sm">
              {problem}
            </Text>
          ))}
        </Alert>
      )}
      {problems.warnings.length > 0 && (
        <Alert color="yellow" title="Fields not on the form">
          {problems.warnings.map((problem) => (
            <Text key={problem} size="sm">
              {problem}
            </Text>
          ))}
        </Alert>
      )}

      {json !== undefined ? (
        <JsonEditor value={json} onChange={editJson} height={360} />
      ) : list.length === 0 ? (
        <Text c="dimmed" size="sm">
          No custom messages — the built-in messages below are used.
        </Text>
      ) : (
        <Card withBorder>
          <Stack gap="sm">
            {list.map((rule) => (
              <Group
                key={`${rule.path}\u0000${rule.keyword}`}
                justify="space-between"
                align="flex-start"
                wrap="nowrap"
              >
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500}>
                    {fieldTitle(rule.path, fieldMap)} · {keywordLabel(rule.keyword)}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {rule.path}
                  </Text>
                  <Text size="sm">{rule.message}</Text>
                </Stack>
                <Group gap={4} wrap="nowrap">
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    onClick={() => setForm({ open: true, rule })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    size="compact-sm"
                    onClick={() => confirmDelete(rule)}
                  >
                    Delete
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Group>
        <Button onClick={save} disabled={!dirty || blocked} loading={update.isPending}>
          Save
        </Button>
        {dirty && (
          <Badge color="yellow" variant="light">
            Unsaved changes
          </Badge>
        )}
      </Group>

      <Accordion variant="contained">
        <Accordion.Item value="built-in">
          <Accordion.Control>
            Built-in messages (used when no custom message matches)
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={4}>
              {BUILT_IN_MESSAGES.map((builtIn) => (
                <Text key={`${builtIn.keyword}-${builtIn.template}`} size="sm">
                  <Text span fw={500}>
                    {keywordLabel(builtIn.keyword)}:
                  </Text>{' '}
                  {builtIn.template}
                </Text>
              ))}
              <Text size="xs" c="dimmed">
                Anything else shows the validator's own message.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <ErrorMessageRuleForm
        key={form.rule ? `${form.rule.path}\u0000${form.rule.keyword}` : `new-${String(form.open)}`}
        opened={form.open}
        fields={fields}
        rule={form.rule}
        existing={rules}
        onClose={() => setForm({ open: false })}
        onSubmit={(rule) => {
          change(setRule(rules, rule, form.rule));
          setForm({ open: false });
        }}
      />
    </Stack>
  );
}
