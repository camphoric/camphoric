import React from 'react';
import { Button } from 'react-bootstrap';

import JsonSchemaForm from 'components/JsonSchemaForm';
import ShowRawJSON from 'components/ShowRawJSON';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import { Select } from 'components/Input';
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
  const modalRef  = React.useRef<ConfirmDialog>(null);

  const deleteRegistration = () => modalRef.current?.show();

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
    console.log('registration type change', e);

    patchRegistration({
      id: registration.id,
      registration_type: e.target.value === 'none' ? null : e.target.value,
    });
  };

  return (
    <div>
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
        value={registration.registration_type || 'none'}
      />
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
        <div className="button-container">
          <Button type="submit" variant="primary">
            Save Registration
          </Button>

          <Button
            onClick={deleteRegistration}
            variant="danger"
          >
            Delete Registration
          </Button>
        </div>
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
