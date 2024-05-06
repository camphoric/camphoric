import React from 'react';

import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import {
  Alert,
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import JsonSchemaForm, {
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm/AdminEdit';
import api from 'hooks/api';

type FormData = {
  [key: string]: any;
};

interface Props {
  event: ApiEvent;
  registration: AugmentedRegistration;
}

function RegAdminAttributes({ event, registration }: Props) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>();
  const [patchRegistration] = api.useUpdateRegistrationMutation();
  const [formData, setFormData] = React.useState(registration.admin_attributes);
  const [registrationId, setRegistrationId] = React.useState(registration.id);

  React.useEffect(() => {
    if (registrationId.toString() !== registration.id.toString()) {
      setRegistrationId(registration.id);
      setFormData(registration.admin_attributes);
    }
  }, [registrationId, formData, registration]);

  if (loading) return <Spinner />;

  const onDataChange = (evt: JsonSchemaFormChangeEvent<FormData>) => {
    setFormData(evt.formData);
  }

  const save = async () => {
    setLoading(true);

    const res = await patchRegistration({
      id: registration.id,
      admin_attributes: formData,
    });

    setLoading(false);

    if ('error' in res) {
      setError(res.error);

      return;
    }

    setError(undefined);
  }

  const { dataSchema, uiSchema } = Object.entries(event.registration_admin_schema).reduce(
    (acc, [key, schemas]) => {
      return {
        dataSchema: {
          ...acc.dataSchema,
          [key]: schemas.data,
        },
        uiSchema: {
          ...acc.uiSchema,
          [key]: schemas.ui,
        },
      }
    }, { dataSchema: {}, uiSchema: {} } as { dataSchema: RJSFSchema, uiSchema: UiSchema }
  );

  uiSchema['ui:order'] = Object.entries(event.registration_admin_schema)
    .sort((a, b) => a[1].data.title.localeCompare(b[1].data.title))
    .map(([key, camper]) => key);

  return (
    <>
      {
        !!error && (
          <Alert variant="danger">{error}</Alert>
        )
      }
      <JsonSchemaForm
        schema={{
          type: 'object',
          properties: dataSchema,
        }}
        // @ts-ignore
        uiSchema={uiSchema}
        formData={formData}
        onChange={onDataChange}
        templateData={{ }}
      />

      <Button onClick={save}>Save</Button>
    </>
  );
}

export default RegAdminAttributes;
