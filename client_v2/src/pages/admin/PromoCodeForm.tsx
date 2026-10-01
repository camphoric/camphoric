/**
 * Add or edit a promo code (SPEC §8.8; §15, DR-67): its label (which names the
 * discount on price breakdowns), the code registrants enter, the discount — a
 * JsonLogic expression worked out once for the registration or for each camper
 * — and whether, and until when, registrants can use it.
 */

import { Alert, Button, Group, Input, Radio, Stack, Switch, Text, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import type { ApiPromoCode, PromoScope } from 'api-types';
import { JsonEditor } from 'components/JsonEditor';
import { ReadOnlyFieldset } from 'hooks/permissions';
import { useMemo } from 'react';
import { isoToLocalDateTime, localDateTimeToIso } from 'utils/dates';

/** What the form saves. */
export type PromoCodeBody = Pick<
  ApiPromoCode,
  'label' | 'code' | 'pricing_logic' | 'scope' | 'enabled' | 'expiration_date'
>;

interface Values {
  label: string;
  code: string;
  logic: string;
  scope: PromoScope;
  enabled: boolean;
  /** A DateTimePicker value (local time), or '' for none. */
  expires: string;
}

interface PromoCodeFormProps {
  /** The code being edited; omit to add one. */
  promoCode?: ApiPromoCode;
  onSubmit: (body: PromoCodeBody) => void;
  onCancel: () => void;
  saving?: boolean;
  /** The server's messages by field, from a refused save. */
  errors?: Record<string, string>;
}

function jsonError(text: string): string | null {
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export function PromoCodeForm({
  promoCode,
  onSubmit,
  onCancel,
  saving,
  errors = {},
}: PromoCodeFormProps) {
  const form = useForm<Values>({
    initialValues: {
      label: promoCode?.label ?? '',
      code: promoCode?.code ?? '',
      logic: JSON.stringify(promoCode?.pricing_logic ?? 0, null, 2),
      scope: promoCode?.scope ?? 'registration',
      enabled: promoCode?.enabled ?? true,
      expires: promoCode?.expiration_date ? isoToLocalDateTime(promoCode.expiration_date) : '',
    },
    validate: {
      label: (value) => (value.trim() ? null : 'Give the code a label'),
      code: (value) => (value.trim() ? null : 'Enter the code registrants type'),
    },
  });
  const logicError = useMemo(() => jsonError(form.values.logic), [form.values.logic]);

  const handleSubmit = (values: Values) => {
    if (logicError) return;
    onSubmit({
      label: values.label.trim(),
      code: values.code.trim(),
      pricing_logic: JSON.parse(values.logic) as unknown,
      scope: values.scope,
      enabled: values.enabled,
      expiration_date: values.expires ? localDateTimeToIso(values.expires) : null,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <ReadOnlyFieldset>
          <Stack>
            <TextInput
              label="Label"
              description="Names the discount on the registrant’s price breakdown."
              withAsterisk
              {...form.getInputProps('label')}
              error={form.errors.label ?? errors.label}
            />
            <TextInput
              label="Code"
              description="What registrants enter; capitals don’t matter."
              withAsterisk
              {...form.getInputProps('code')}
              error={form.errors.code ?? errors.code}
            />
            <Radio.Group
              label="The discount is worked out"
              {...form.getInputProps('scope')}
              error={errors.scope}
            >
              <Group mt="xs">
                <Radio value="registration" label="Once, for the registration" />
                <Radio value="camper" label="For each camper" />
              </Group>
            </Radio.Group>
            <Input.Wrapper
              label="Discount"
              description={
                form.values.scope === 'camper'
                  ? 'JsonLogic for the amount off each camper (a positive number). It sees the camper (camper.…) and their price lines, e.g. {"*": [{"var": "tuition"}, 0.4]}. It can’t take a camper below $0.'
                  : 'JsonLogic for the amount off (a positive number). It sees the registration and its price lines, camper lines added up, e.g. {"*": [{"var": "total"}, 0.1]}. It can’t take the total below $0.'
              }
              error={errors.pricing_logic}
            >
              <Stack gap="xs" mt="xs">
                <JsonEditor
                  value={form.values.logic}
                  onChange={(value) => form.setFieldValue('logic', value)}
                  height={160}
                  path={`promo-code-${promoCode?.id ?? 'new'}.json`}
                />
                {logicError && (
                  <Alert color="red" variant="light" title="Invalid JSON">
                    {logicError}
                  </Alert>
                )}
              </Stack>
            </Input.Wrapper>
            <Switch
              label="Registrants can use it"
              {...form.getInputProps('enabled', { type: 'checkbox' })}
            />
            <DateTimePicker
              label="Expires"
              description="Registrants can’t use it after this. Leave empty for no end."
              valueFormat="MM/DD/YYYY h:mm A"
              clearable
              value={form.values.expires || null}
              onChange={(value) => form.setFieldValue('expires', value ?? '')}
              error={errors.expiration_date}
              maw={320}
            />
          </Stack>
        </ReadOnlyFieldset>
        <Text size="xs" c="dimmed">
          Registrations that already have the code keep it — and its discount — if it’s later turned
          off, expires or is deleted.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!!logicError}>
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
