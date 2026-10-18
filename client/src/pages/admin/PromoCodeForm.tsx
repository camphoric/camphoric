/**
 * Add or edit a promo code (SPEC §8.8; §15, DR-67): its label (which names the
 * discount on price breakdowns), the code registrants enter, the discount — a
 * JsonLogic expression worked out once for the registration or for each camper
 * — whether, and until when, registrants can use it, and which registrants
 * can't: those of some registration types, or those without an invitation
 * (§15, DR-107).
 */

import {
  Alert,
  Button,
  Checkbox,
  Group,
  Input,
  Radio,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import type { ApiPromoCode, ApiRegistrationType, PromoScope } from 'api-types';
import { EditLeaseNotice } from 'components/EditLease';
import { FormActions } from 'components/FormActions';
import { JsonEditor } from 'components/JsonEditor';
import { CanEdit, ReadOnlyFieldset, ViewOnly } from 'hooks/permissions';
import { useLatestWhileUnchanged } from 'hooks/useEditableRecord';
import { useEditLease } from 'hooks/useEditLease';
import { useMemo } from 'react';
import { isoToLocalDateTime, localDateTimeToIso } from 'utils/dates';

/** What the form saves. */
export type PromoCodeBody = Pick<
  ApiPromoCode,
  | 'label'
  | 'code'
  | 'pricing_logic'
  | 'scope'
  | 'enabled'
  | 'expiration_date'
  | 'excluded_registration_types'
  | 'excludes_uninvited'
>;

/** The choice, among the excluded types, for registrants without an invitation. */
const UNINVITED = 'uninvited';

interface Values {
  label: string;
  code: string;
  logic: string;
  scope: PromoScope;
  enabled: boolean;
  /** A DateTimePicker value (local time), or '' for none. */
  expires: string;
  /** Who can't use it: registration type ids, and UNINVITED. */
  excluded: string[];
}

interface PromoCodeFormProps {
  /** The code being edited; omit to add one. */
  promoCode?: ApiPromoCode;
  /** The event's registration types, any of which the code can exclude; omit while loading. */
  registrationTypes?: ApiRegistrationType[];
  /** With the version of the code the form showed (none for a new one). */
  onSubmit: (body: PromoCodeBody, shown?: ApiPromoCode) => void;
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

const valuesOf = (promoCode?: ApiPromoCode): Values => ({
  label: promoCode?.label ?? '',
  code: promoCode?.code ?? '',
  logic: JSON.stringify(promoCode?.pricing_logic ?? 0, null, 2),
  scope: promoCode?.scope ?? 'registration',
  enabled: promoCode?.enabled ?? true,
  expires: promoCode?.expiration_date ? isoToLocalDateTime(promoCode.expiration_date) : '',
  excluded: [
    ...(promoCode?.excludes_uninvited ? [UNINVITED] : []),
    ...(promoCode?.excluded_registration_types ?? []).map(String),
  ],
});

export function PromoCodeForm({
  promoCode: latest,
  registrationTypes,
  onSubmit,
  onCancel,
  saving,
  errors = {},
}: PromoCodeFormProps) {
  const form = useForm<Values>({
    initialValues: valuesOf(latest),
    validate: {
      label: (value) => (value.trim() ? null : 'Give the code a label'),
      code: (value) => (value.trim() ? null : 'Enter the code registrants type'),
    },
  });
  // The version shown: a newer one shows while nothing here is unsaved.
  const [promoCode] = useLatestWhileUnchanged<ApiPromoCode>(
    latest,
    (): boolean => !form.isDirty(),
    (record): void => {
      const values = valuesOf(record);
      form.setInitialValues(values);
      form.setValues(values);
      form.resetDirty(values);
    },
  );
  const logicError = useMemo(() => jsonError(form.values.logic), [form.values.logic]);

  const handleSubmit = (values: Values) => {
    if (logicError) return;
    onSubmit(
      {
        label: values.label.trim(),
        code: values.code.trim(),
        pricing_logic: JSON.parse(values.logic) as unknown,
        scope: values.scope,
        enabled: values.enabled,
        expiration_date: values.expires ? localDateTimeToIso(values.expires) : null,
        // A type deleted since the code was loaded is no longer one to exclude.
        excluded_registration_types: values.excluded
          .filter((value) => value !== UNINVITED)
          .map(Number)
          .filter((id) => !registrationTypes || registrationTypes.some((type) => type.id === id)),
        excludes_uninvited: values.excluded.includes(UNINVITED),
      },
      promoCode,
    );
  };

  // Who else is editing it (§9.8): held while there are unsaved changes.
  const lease = useEditLease(
    promoCode ? 'promocode' : undefined,
    promoCode?.id ?? 0,
    form.isDirty(),
  );

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <EditLeaseNotice label="promo code" lease={lease} />
      <ViewOnly when={lease.viewOnly}>
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
              <Checkbox.Group
                label="Who can’t use it"
                description="These registrants are told the code can’t be used with their registration."
                {...form.getInputProps('excluded')}
                error={errors.excluded_registration_types ?? errors.excludes_uninvited}
              >
                <Stack gap="xs" mt="xs">
                  <Checkbox value={UNINVITED} label="Registrants without an invitation" />
                  {(registrationTypes ?? []).map((type) => (
                    <Checkbox
                      key={type.id}
                      value={String(type.id)}
                      label={`Invited as ${type.label || type.name}`}
                    />
                  ))}
                </Stack>
              </Checkbox.Group>
            </Stack>
          </ReadOnlyFieldset>
          <Text size="xs" c="dimmed">
            Registrations that already have the code keep it — and its discount — if it’s later
            turned off, expires, is deleted or stops being for them.
          </Text>
          <FormActions>
            <Button variant="default" onClick={onCancel}>
              Cancel
            </Button>
            <CanEdit>
              <Button type="submit" loading={saving} disabled={!!logicError}>
                Save
              </Button>
            </CanEdit>
          </FormActions>
        </Stack>
      </ViewOnly>
    </form>
  );
}
