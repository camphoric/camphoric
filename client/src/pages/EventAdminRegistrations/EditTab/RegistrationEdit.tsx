import React from 'react';
import { Button } from 'react-bootstrap';

import JsonSchemaForm from 'components/JsonSchemaForm';
import ShowRawJSON from 'components/ShowRawJSON';
import ConfirmDialog from 'components/Modal/ConfirmDialog';

import api from 'store/api';

interface Props {
  registration: AugmentedRegistration;
  event: ApiEvent;
}

function RegistrationEdit(props: Props) {
  const [deleteRegistrationApi] = api.useDeleteRegistrationMutation();
  const modalRef  = React.useRef<ConfirmDialog>(null);
  const { registration, event } = props;
  const deleteRegistration = () => modalRef.current?.show();

  return (
    <div>
      <JsonSchemaForm
        schema={event.registration_schema}
        uiSchema={event.registration_ui_schema}
        formData={registration.attributes}
        templateData={{
          pricing: event.pricing,
          formData: registration.attributes,
          totals: registration.server_pricing_results,
        }}
      >
        <Button type="submit" variant="primary">
          Save Registration
        </Button>

        <Button
          onClick={deleteRegistration}
          variant="danger"
        >
          Delete Registration
        </Button>
      </JsonSchemaForm>
      <ShowRawJSON label="registration" json={registration} />
      <ConfirmDialog
        ref={modalRef}
        title={`Delete registration ${registration.registrant_email}?`}
        onConfirm={() => deleteRegistrationApi(registration)}
      />
    </div>
  );
}

export default RegistrationEdit;
