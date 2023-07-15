import React from 'react';

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
  camper: ApiCamper;
}

function CamperAdminAttributesTab({ event, camper }: Props) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>();
  const [patchCamper] = api.useUpdateCamperMutation();
  const [formData, setFormData] = React.useState(camper.admin_attributes);
  const [camperId, setCamperId] = React.useState(camper.id);

  React.useEffect(() => {
    if (camperId.toString() !== camper.id.toString()) {
      setCamperId(camper.id);
      setFormData(camper.admin_attributes);
    }
  }, [camperId, formData, camper]);


  if (loading) return <Spinner />;

  const onDataChange = (evt: JsonSchemaFormChangeEvent<FormData>) => {
    setFormData(evt.formData);
  }

  const save = async () => {
    setLoading(true);

    const res = await patchCamper({
      id: camper.id,
      admin_attributes: formData,
    });

    setLoading(false);

    if ('error' in res) {
      setError(res.error);

      return;
    }

    setError(undefined);
  }

  const { dataSchema, uiSchema } = Object.entries(event.camper_admin_schema).reduce(
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
    }, { dataSchema: {}, uiSchema: {} }
  );

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
        uiSchema={uiSchema}
        formData={formData}
        onChange={onDataChange}
        templateData={{ }}
      />

      <Button onClick={save}>Save</Button>
    </>
  );
}

export default CamperAdminAttributesTab;
