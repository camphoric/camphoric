import React from 'react';
import {
  Button,
  Card,
  Row,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import api, { useEvent, useRegistrationTypeLookup } from 'hooks/api';
import { alphaSort } from 'utils/display';

import InviteForm from './InviteForm';
import RegTypeForm from './RegTypeForm';

function ControlColumn() {
  const eventApi = useEvent();

  const registrationTypeLookup = useRegistrationTypeLookup();
  const [deleteRegType] = api.useDeleteRegistrationTypeMutation();

  const [showInviteModal, setShowInviteModal] = React.useState<boolean>(false);
  const [showRegTypeModal, setShowRegTypeModal] = React.useState<boolean>(false);
  const [regTypeSelected, setRegTypeSelected] = React.useState<ApiRegistrationType | undefined>();

  if (eventApi.isFetching || eventApi.isLoading || !eventApi.data) return <Spinner />;
  if (!registrationTypeLookup) return <Spinner />;

  const regTypes = Object.values(registrationTypeLookup).sort(alphaSort('label'));

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
