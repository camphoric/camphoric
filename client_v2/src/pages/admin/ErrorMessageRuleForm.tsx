/**
 * Add or edit one validation message (SPEC §8.8, DR-34): which field, which kind
 * of error, and the message — with a live preview using sample values. Fields
 * and the error types each can fail with come from the registration form's full
 * schema (`collectFieldPaths`); a path can also be typed directly. A duplicate
 * field + error type or a broken template can't be saved; a path the form
 * doesn't have is allowed with a warning (the field may be added later).
 */

import {
  Alert,
  Button,
  Checkbox,
  Code,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import type { RegistrationErrorMessages } from 'api-types';
import {
  builtInTemplate,
  ERROR_KEYWORDS,
  type ErrorKeyword,
  type ErrorMessageRule,
  type FieldPathInfo,
  KEYWORD_LABELS,
} from 'components/form';
import { checkTemplate, renderPlainTextTemplate } from 'components/templating';
import { useMemo, useState } from 'react';

/** The path meaning "every field" (the event-wide default for an error type). */
export const EVERY_FIELD = '*';

const SAMPLE_CAMPER = '2nd camper (Alex Sample)';

interface ErrorMessageRuleFormProps {
  opened: boolean;
  /** The registration form's fields (`collectFieldPaths`), in schema order. */
  fields: FieldPathInfo[];
  /** The rule being edited; omitted when adding. */
  rule?: ErrorMessageRule;
  /** The current rules, to stop a second message for the same field + error type. */
  existing: RegistrationErrorMessages;
  onSubmit: (rule: ErrorMessageRule) => void;
  onClose: () => void;
}

/** "Campers › Phone Number" (or "Every field"). */
export function fieldTitle(path: string, fields: Map<string, FieldPathInfo>): string {
  if (path === EVERY_FIELD) return 'Every field';
  return fields.get(path)?.breadcrumb.filter(Boolean).join(' › ') || path;
}

const keywordLabel = (keyword: string) =>
  (KEYWORD_LABELS as Record<string, string>)[keyword] ?? keyword;

export function ErrorMessageRuleForm({
  opened,
  fields,
  rule,
  existing,
  onSubmit,
  onClose,
}: ErrorMessageRuleFormProps) {
  const byPath = useMemo(() => new Map(fields.map((field) => [field.path, field])), [fields]);
  const [path, setPath] = useState(rule?.path ?? '');
  const [customPath, setCustomPath] = useState(
    Boolean(rule && rule.path !== EVERY_FIELD && fields.length > 0 && !byPath.has(rule.path)),
  );
  const [keyword, setKeyword] = useState(rule?.keyword ?? '');
  const [message, setMessage] = useState(rule?.message ?? '');
  const [submitted, setSubmitted] = useState(false);

  const field = byPath.get(path);
  const fieldOptions = [
    { value: EVERY_FIELD, label: 'Every field (event-wide default)' },
    ...fields.map((f) => ({ value: f.path, label: `${fieldTitle(f.path, byPath)} — ${f.path}` })),
  ];
  const keywords: string[] = field?.keywords.length ? [...field.keywords] : [...ERROR_KEYWORDS];
  if (keyword && !keywords.includes(keyword)) keywords.push(keyword);

  const trimmedPath = path.trim();
  const templateError = message.trim() ? checkTemplate(message) : null;
  const duplicate =
    trimmedPath &&
    keyword &&
    existing[trimmedPath]?.[keyword] !== undefined &&
    !(rule && rule.path === trimmedPath && rule.keyword === keyword);
  const unknownPath =
    trimmedPath && trimmedPath !== EVERY_FIELD && fields.length > 0 && !byPath.has(trimmedPath);

  const errors = {
    path: !trimmedPath ? 'Choose a field' : undefined,
    keyword: !keyword
      ? 'Choose an error type'
      : duplicate
        ? 'This field already has a message for this error type'
        : undefined,
    message: !message.trim() ? 'Write a message' : (templateError ?? undefined),
  };
  const valid = !errors.path && !errors.keyword && !errors.message;

  const preview = useMemo(() => {
    if (!message.trim() || templateError) return undefined;
    const isCamperField = trimmedPath.startsWith('campers.');
    try {
      return renderPlainTextTemplate(message, {
        field: field?.label ?? (trimmedPath === EVERY_FIELD ? 'Phone Number' : 'This field'),
        camper: isCamperField || trimmedPath === EVERY_FIELD ? SAMPLE_CAMPER : '',
        camperNumber: isCamperField || trimmedPath === EVERY_FIELD ? 2 : undefined,
        params: field?.params[keyword as ErrorKeyword] ?? {},
      });
    } catch (error) {
      return `Couldn't render: ${String(error)}`;
    }
  }, [message, templateError, trimmedPath, field, keyword]);

  const save = () => {
    setSubmitted(true);
    if (!valid) return;
    onSubmit({ path: trimmedPath, keyword, message: message.trim() });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={rule ? 'Edit validation message' : 'New validation message'}
    >
      <Stack>
        {customPath ? (
          <TextInput
            label="Field path"
            description="Array positions are written as * — e.g. campers.*.phone"
            value={path}
            onChange={(event) => setPath(event.currentTarget.value)}
            error={submitted ? errors.path : undefined}
            ff="monospace"
          />
        ) : (
          <Select
            label="Field"
            placeholder="Choose a field"
            data={fieldOptions}
            value={path || null}
            onChange={(value) => {
              setPath(value ?? '');
              setKeyword('');
            }}
            searchable
            nothingFoundMessage="No matching field"
            error={submitted ? errors.path : undefined}
          />
        )}
        <Checkbox
          label="Enter a field path directly"
          checked={customPath}
          onChange={(event) => setCustomPath(event.currentTarget.checked)}
        />
        {unknownPath && (
          <Alert color="yellow" variant="light">
            The registration form has no field at <Code>{trimmedPath}</Code> right now. The message
            will apply if one is added.
          </Alert>
        )}
        <Select
          label="Error type"
          placeholder="Choose an error type"
          data={keywords.map((value) => ({ value, label: keywordLabel(value) }))}
          value={keyword || null}
          onChange={(value) => setKeyword(value ?? '')}
          error={submitted || duplicate ? errors.keyword : undefined}
        />
        <Textarea
          label="Message"
          description="Placeholders: {{camper}} (e.g. “2nd camper (Alex Sample)”), {{camperNumber}}, {{field}} (the field's name), and {{params.limit}} / {{params.pattern}} where the error has them."
          placeholder={builtInTemplate(keyword) ?? ''}
          autosize
          minRows={2}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
          error={submitted || templateError ? errors.message : undefined}
        />
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" mb={4}>
            Preview
          </Text>
          <Text size="sm" c={preview ? 'red' : 'dimmed'} data-testid="rule-preview">
            {preview ?? 'The message will appear here.'}
          </Text>
        </Paper>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{rule ? 'Update' : 'Add'}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
