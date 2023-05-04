import React from 'react';

import { Button } from 'react-bootstrap';
import { getCamperDisplayId } from 'utils/display';
import JsonSchemaForm, {
  JsonSchemaFormChangeEvent,
  FormData,
} from 'components/JsonSchemaForm/AdminEdit';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import api from 'store/api';

import ShowRawJSON from 'components/ShowRawJSON';

interface Props {
  camper: ApiCamper;
  event: ApiEvent,
}

function CamperEdit({ camper, event }: Props) {
  const [deleteCamperApi] = api.useDeleteCamperMutation();
  const [patchCamper] = api.useUpdateCamperMutation();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const deleteCamper = () => deleteModal.current?.show();
  const [formData, setFormData] = React.useState(camper.attributes);

  const saveCamper = () => {
    patchCamper({
      id: camper.id,
      attributes: formData,
    });
  }

  const onDataChange = (evt: JsonSchemaFormChangeEvent<FormData>) => {
    setFormData(evt.formData);
  }

  const camperUISchema = (event.registration_ui_schema as any).campers?.items;

  return (
    <div>
      <JsonSchemaForm
        schema={{
          definitions: event.registration_schema.definitions,
          ...event.camper_schema
        }}
        uiSchema={camperUISchema}
        formData={formData}
        onChange={onDataChange}
        templateData={{
          pricing: event.pricing,
          formData: camper.attributes,
        }}
      />
      <div className="button-container">
        <Button
          variant="primary"
          onClick={saveCamper}
        >
          Save Camper
        </Button>
        <Button
          onClick={deleteCamper}
          variant="danger"
        >
          Delete Camper
        </Button>
      </div>
      <ShowRawJSON label="camper" json={camper} />
      <ConfirmDialog
        ref={deleteModal}
        title={`Delete camper ${getCamperDisplayId(camper)}?`}
        onConfirm={() => deleteCamperApi(camper)}
      />
    </div>
  );
}

export default CamperEdit;
