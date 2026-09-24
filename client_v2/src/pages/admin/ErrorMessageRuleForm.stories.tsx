/**
 * Ladle stories for ErrorMessageRuleForm (SPEC §8.8, DR-34): adding a message
 * (pick a field from a Harmony-like registration schema, then an error type,
 * and watch the preview) and editing an existing one. Run `npm run ladle`.
 */

import type { Story } from '@ladle/react';
import { Button, Code, Stack } from '@mantine/core';
import type { RJSFSchema } from '@rjsf/utils';
import type { RegistrationErrorMessages } from 'api-types';
import { collectFieldPaths, type ErrorMessageRule } from 'components/form';
import { useState } from 'react';

import { ErrorMessageRuleForm } from './ErrorMessageRuleForm';

const schema = {
  type: 'object',
  properties: {
    registrant_email: { type: 'string', format: 'email', title: 'Registrant email' },
    campers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['first_name'],
        properties: {
          first_name: { type: 'string', title: 'First name', maxLength: 50 },
          phone: { type: 'string', title: 'Phone Number', pattern: '^\\+[0-9]+$' },
          lodging: {
            type: 'object',
            title: 'Lodging',
            properties: {
              lodging_requested: {
                type: 'object',
                title: 'Lodging',
                required: ['id', 'choices'],
                properties: { id: { type: 'number' }, choices: { type: 'array' } },
              },
            },
          },
        },
      },
    },
  },
} as RJSFSchema;

const fields = [...collectFieldPaths(schema, { campers: { 'ui:title': 'Campers' } }).values()];

function Harness({
  rule,
  initial,
}: {
  rule?: ErrorMessageRule;
  initial: RegistrationErrorMessages;
}) {
  const [opened, setOpened] = useState(true);
  const [saved, setSaved] = useState<ErrorMessageRule | undefined>();
  return (
    <Stack maw={560} p="md">
      <Button onClick={() => setOpened(true)}>Open the form</Button>
      <Code block>{JSON.stringify(saved ?? 'nothing saved yet', null, 2)}</Code>
      <ErrorMessageRuleForm
        opened={opened}
        fields={fields}
        rule={rule}
        existing={initial}
        onClose={() => setOpened(false)}
        onSubmit={(next) => {
          setSaved(next);
          setOpened(false);
        }}
      />
    </Stack>
  );
}

/** A new message: choose a field and error type, write the message, see the preview. */
export const AddMessage: Story = () => <Harness initial={{}} />;

/** Editing the Camp Harmony lodging message. */
export const EditMessage: Story = () => {
  const rule = {
    path: 'campers.*.lodging.lodging_requested.id',
    keyword: 'required',
    message:
      '{{camper}}: please finish choosing your lodging — if you picked RV Camping, choose your RV length',
  };
  return <Harness rule={rule} initial={{ [rule.path]: { [rule.keyword]: rule.message } }} />;
};
