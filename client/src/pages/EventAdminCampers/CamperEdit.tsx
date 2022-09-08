import React from 'react';

import { Button } from 'react-bootstrap';
import { getCamperDisplayId } from 'utils/display';
import JsonSchemaForm from 'components/JsonSchemaForm';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import api from 'store/api';

import ShowRawJSON from 'components/ShowRawJSON';

interface Props {
  camper: ApiCamper;
  event: ApiEvent,
}

function CamperEdit({ camper, event }: Props) {
  const [deleteCamperApi] = api.useDeleteCamperMutation();
  const modalRef  = React.useRef<ConfirmDialog>(null);
  const deleteCamper = () => modalRef.current?.show();

  const camperUISchema = (event.registration_ui_schema as any).campers;

  return (
    <div>
      <JsonSchemaForm
        schema={{
          definitions: event.registration_schema.definitions,
          ...event.camper_schema
        }}
        uiSchema={camperUISchema}
        formData={camper.attributes}
        templateData={{
          pricing: event.pricing,
          formData: camper.attributes,
        }}
      >
        <Button type="submit" variant="primary">
          Save Camper
        </Button>

        <Button
          onClick={deleteCamper}
          variant="danger"
        >
          Delete Camper
        </Button>
      </JsonSchemaForm>
      <ShowRawJSON label="camper" json={camper} />
      <ConfirmDialog
        ref={modalRef}
        title={`Delete camper ${getCamperDisplayId(camper)}?`}
        onConfirm={() => deleteCamperApi(camper)}
      />
    </div>
  );
}

export default CamperEdit;
