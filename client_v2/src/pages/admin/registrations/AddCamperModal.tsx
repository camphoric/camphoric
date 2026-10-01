/**
 * Add a camper to an existing registration (SPEC §8.4; issue #486) — for
 * organizers after registration has closed, or to fix a registration. The
 * event's camper questions in admin mode, checked on submit like the
 * registration form; the camper joins the end of the registration's list and
 * the registration's price follows. Lodging is assigned afterwards, as usual.
 */

import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { ApiCamper, ApiEvent, Hash, Scalar } from 'api-types';
import { JsonSchemaForm } from 'components/form';
import { useCamperForm } from 'pages/admin/campers/camperForm';
import { EDITOR_MODAL_SIZE } from 'pages/admin/editorModalStyles';
import { useState } from 'react';
import type { CreateBody } from 'store/createEntityHooks';
import { camperHooks } from 'store/entities';

interface AddCamperModalProps {
  event: ApiEvent;
  registrationId: Scalar;
  /** Where the new camper goes in the registration's list. */
  sequence: number;
  opened: boolean;
  onClose: () => void;
}

export function AddCamperModal({ opened, onClose, ...props }: AddCamperModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Add camper" size={EDITOR_MODAL_SIZE}>
      {/* Mounted only while open, so each camper starts from a blank form. */}
      {opened && <AddCamperForm {...props} onClose={onClose} />}
    </Modal>
  );
}

function AddCamperForm({
  event,
  registrationId,
  sequence,
  onClose,
}: Omit<AddCamperModalProps, 'opened'>) {
  const create = camperHooks.useCreate();
  const { schema, uiSchema } = useCamperForm(event);
  const [attributes, setAttributes] = useState<Hash>({});

  const add = (formData: Hash) =>
    create.mutate(
      {
        registration: registrationId,
        attributes: formData,
        admin_attributes: {},
        sequence,
        // The server works out the pricing, and lodging starts unassigned.
      } as unknown as CreateBody<ApiCamper>,
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Camper added' });
          onClose();
        },
      },
    );

  return (
    <>
      <Text size="sm" c="dimmed" mb="md">
        They join this registration, and its price is worked out again. Assign their lodging
        afterwards.
      </Text>
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={attributes}
        templateData={{
          ...event.registration_template_vars,
          pricing: event.pricing,
          formData: attributes,
        }}
        errorMessages={{
          rules: event.registration_error_messages,
          pathPrefix: 'campers.*',
          camper: { label: 'this camper' },
        }}
        onChange={(formData) => setAttributes(formData as Hash)}
        onSubmit={(formData) => add(formData as Hash)}
      >
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Add camper
          </Button>
        </Group>
      </JsonSchemaForm>
    </>
  );
}
