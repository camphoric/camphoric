import React from 'react';
import { Button } from 'react-bootstrap';

import JsonSchemaForm, {
  JsonSchemaFormChangeEvent,
  FormData,
} from 'components/JsonSchemaForm/AdminEdit';
import ShowRawJSON from 'components/ShowRawJSON';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import TextInput, { Select } from 'components/Input';
import Spinner from 'components/Spinner';

import api from 'store/api';

interface Props {
  registration: AugmentedRegistration;
  event: ApiEvent;
}

function RegistrationEdit({ registration, event, ...props}: Props) {
  const [deleteRegistrationApi] = api.useDeleteRegistrationMutation();
  const [patchRegistration] = api.useUpdateRegistrationMutation();
  const registrationTypesApi = api.useGetRegistrationTypesQuery();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const [formData, setFormData] = React.useState(registration.attributes);
  const [regEmail, setRegEmail] = React.useState<string>(registration.registrant_email);
  const [regType, setRegType] = React.useState<string | null>();

  const deleteRegistration = () => deleteModal.current?.show();
  const saveRegistration = () => {
    patchRegistration({
      id: registration.id,
      registrant_email: regEmail,
      ...(
        regType === undefined ? {} : { registration_type: regType }
      ),
      attributes: formData,
    });
  }

  if (registrationTypesApi.isFetching || registrationTypesApi.isLoading || !registrationTypesApi.data) return <Spinner />;

  const regTypesOptions = registrationTypesApi.data
    .filter(r => r.event.toString() === event.id.toString())
    .map(
    (rt: ApiRegistrationType) => ({
      label: rt.label,
      value: rt.id,
    })
  );

  const onRegTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegType(e.target.value === 'none' ? null : e.target.value);
  };

  const onDataChange = (evt: JsonSchemaFormChangeEvent<FormData>) => {
    setFormData(evt.formData);
  }

  const onRegEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    !!e.target.value && setRegEmail(e.target.value.toString());
  }

  return (
    <div className="registration-edit-form">
      <Select
        label="Registration type"
        options={[
          {
            label: 'None',
            value: 'none',
          },
          ...regTypesOptions,
        ]}
        onChange={onRegTypeChange}
        value={regType || registration.registration_type || 'none'}
      />
      <TextInput
        label="Email"
        value={regEmail}
        onChange={onRegEmailChange}
      />
      <JsonSchemaForm
        schema={event.registration_schema}
        uiSchema={event.registration_ui_schema}
        formData={formData}
        onChange={onDataChange}
        templateData={{
          pricing: event.pricing,
          formData: registration.attributes,
          totals: registration.server_pricing_results,
        }}
      />
      <div className="button-container">
        <Button
          variant="primary"
          onClick={saveRegistration}
        >
          Save Registration
        </Button>
        <Button
          onClick={deleteRegistration}
          variant="danger"
        >
          Delete Registration
        </Button>
      </div>
      <ShowRawJSON label="registration" json={registration} />
      <ConfirmDialog
        ref={deleteModal}
        title={`Delete registration ${registration.registrant_email}?`}
        onConfirm={() => deleteRegistrationApi(registration)}
      />
    </div>
  );
}

export default RegistrationEdit;
