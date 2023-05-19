import React from 'react';
import {
  Button,
  Card,
  Row,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import api from 'store/admin/api';
import { useEvent } from 'hooks/api';
import { alphaSort } from 'utils/display';

import InviteForm from './InviteForm';
import RegTypeForm from './RegTypeForm';

function ControlColumn() {
  const eventApi = useEvent();

  const registrationTypesApi = api.useGetRegistrationTypesQuery();
  const [deleteRegType] = api.useDeleteRegistrationTypeMutation();

  const [showInviteModal, setShowInviteModal] = React.useState<boolean>(false);
  const [showRegTypeModal, setShowRegTypeModal] = React.useState<boolean>(false);
  const [regTypeSelected, setRegTypeSelected] = React.useState<ApiRegistrationType | undefined>();

  if (eventApi.isFetching || eventApi.isLoading || !eventApi.data) return <Spinner />;
  if (registrationTypesApi.isFetching || registrationTypesApi.isLoading || !registrationTypesApi.data) return <Spinner />;

  const eventId = eventApi.data.id;

  const regTypes = registrationTypesApi.data
    .filter(r => r.event === eventId)
    .sort(alphaSort('label'));

  const onClickEdit = (rt: ApiRegistrationType) => () => {
    setRegTypeSelected(rt);
    setShowRegTypeModal(true);
  };

  return (
    <>
      <Row className="control-buttons">
        <Button onClick={() => setShowInviteModal(true)}>New Invite</Button>
      </Row>
      {
        regTypes.map((rt) => (
          <Card key={rt.id}>
            <Card.Header>{ rt.label }</Card.Header>
            <Row className="control-buttons">
              <Button size="sm" variant="outline-primary" onClick={onClickEdit(rt)}>Edit</Button>
              <Button size="sm" variant="outline-danger" onClick={() => deleteRegType(rt)}>Delete</Button>
            </Row>
          </Card>
        ))
      }
      <Row className="control-buttons">
        <Button onClick={() => setShowRegTypeModal(true)}>
          Create New Special Registration Type
        </Button>
      </Row>
      <InviteForm
        registrationTypes={regTypes}
        show={showInviteModal}
        setShow={setShowInviteModal}
      />
      <RegTypeForm
        show={showRegTypeModal}
        setShow={setShowRegTypeModal}
        regType={regTypeSelected}
      />
    </>
  );
}

export default ControlColumn;
