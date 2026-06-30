/**
 * Edit a registration's core fields and schema-driven attributes (SPEC §8.4).
 * Registration type, registrant email, and the `registration_schema` attributes
 * (rendered in admin mode, §9.5) persist via PATCH
 * `{ registrant_email, registration_type, attributes }`. The registration can be
 * deleted (with confirmation). The raw record is exposed as a debugging aid.
 *
 * Payments/fees and admin-only attributes are separate concerns (later slices).
 */

import { Button, Group, Select, Stack, TextInput, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ApiEvent, AugmentedRegistration, Hash, RegistrationTypeLookup } from 'api-types';
import { deriveAdminUiSchema, JsonSchemaForm } from 'components/form';
import { JsonViewer } from 'components/JsonViewer';
import { useEffect, useMemo, useState } from 'react';
import { registrationHooks } from 'store/entities';

const NONE = 'none';

interface RegistrationEditProps {
  event: ApiEvent;
  registration: AugmentedRegistration;
  registrationTypes: RegistrationTypeLookup;
  onDeleted: () => void;
}

export function RegistrationEdit({
  event,
  registration,
  registrationTypes,
  onDeleted,
}: RegistrationEditProps) {
  const update = registrationHooks.useUpdate();
  const del = registrationHooks.useDelete();

  const [email, setEmail] = useState(registration.registrant_email);
  const [regType, setRegType] = useState<string>(
    registration.registration_type == null ? NONE : String(registration.registration_type),
  );
  const [attributes, setAttributes] = useState<Hash>(registration.attributes);

  // Reset the controlled fields when a different registration is selected.
  useEffect(() => {
    setEmail(registration.registrant_email);
    setRegType(
      registration.registration_type == null ? NONE : String(registration.registration_type),
    );
    setAttributes(registration.attributes);
  }, [registration]);

  const adminUiSchema = useMemo(
    () => deriveAdminUiSchema(event.registration_ui_schema),
    [event.registration_ui_schema],
  );

  const typeOptions = [
    { value: NONE, label: 'None' },
    ...Object.values(registrationTypes).map((rt) => ({ value: String(rt.id), label: rt.label })),
  ];

  const save = () =>
    update.mutate(
      {
        id: registration.id,
        registrant_email: email,
        registration_type: regType === NONE ? null : Number(regType),
        attributes,
      },
      { onSuccess: () => notifications.show({ color: 'green', message: 'Registration saved' }) },
    );

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Delete registration',
      children: <span>Delete the registration for “{registration.registrant_email}”?</span>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate({ id: registration.id }, { onSuccess: onDeleted }),
    });

  return (
    <Stack>
      <Title order={3}>{registration.registrant_email || 'Registration'}</Title>
      <Select
        label="Registration type"
        data={typeOptions}
        value={regType}
        onChange={(value) => setRegType(value ?? NONE)}
        allowDeselect={false}
        maw={320}
      />
      <TextInput
        label="Registrant email"
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
        maw={320}
      />
      <JsonSchemaForm
        schema={event.registration_schema}
        uiSchema={adminUiSchema}
        formData={attributes}
        templateData={{
          pricing: event.pricing,
          formData: registration.attributes,
          totals: registration.server_pricing_results,
        }}
        onChange={(formData) => setAttributes(formData as Hash)}
      >
        <></>
      </JsonSchemaForm>
      <Group>
        <Button onClick={save} loading={update.isPending}>
          Save
        </Button>
        <Button variant="light" color="red" onClick={confirmDelete} loading={del.isPending}>
          Delete
        </Button>
      </Group>
      <JsonViewer value={registration} />
    </Stack>
  );
}
