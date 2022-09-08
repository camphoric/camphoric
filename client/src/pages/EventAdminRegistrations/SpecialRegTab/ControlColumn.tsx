import React from 'react';
import {
  Button,
  Card,
  Row,
} from 'react-bootstrap';

import InviteModal, { InvitePostValues } from './InviteModal';
import RegTypeModal, { RegTypePostValues } from './RegTypeModal';

interface Props {
  registrationTypes: Array<ApiRegistrationType>,
  newInvitation: (s: InvitePostValues) => void,
  newRegType: (s: RegTypePostValues) => void,
  deleteRegType: (id: string | number) => void,
}

function ControlColumn({ registrationTypes, ...props }: Props) {
  const inviteModal = React.useRef<InviteModal>(null);
  const regTypeModal = React.useRef<RegTypeModal>(null);

  const showInviteModal = () =>
    inviteModal.current && inviteModal.current.show();
  const showRegTypeModal = (v?: RegTypePostValues) => () =>
    regTypeModal.current && regTypeModal.current.show(v);
  const deleteRegType = (id: number | string) => () => props.deleteRegType(id);

  return (
    <>
      <Row className="control-buttons">
        <Button onClick={showInviteModal}>Invite</Button>
        <Button onClick={showRegTypeModal()}>New</Button>
      </Row>
      {
        registrationTypes.map((rt) => (
          <Card key={rt.id}>
            <Card.Header>{ rt.label }</Card.Header>
            <Row className="control-buttons">
              <Button size="sm" variant="outline-primary" onClick={showRegTypeModal(rt)}>Edit</Button>
              <Button size="sm" variant="outline-danger" onClick={deleteRegType(rt.id)}>Delete</Button>
            </Row>
          </Card>
        ))
      }
      <InviteModal
        ref={inviteModal}
        registrationTypes={registrationTypes}
        onSave={props.newInvitation}
      />
      <RegTypeModal
        ref={regTypeModal}
        onSave={props.newRegType}
      />
    </>
  );
}

export default ControlColumn;
