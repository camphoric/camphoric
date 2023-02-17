// TODO: refactor using hooks/api for api calls

import React from 'react';
import {
  Container,
  Row,
  Col,
} from 'react-bootstrap';
import debug from 'utils/debug';

import ControlColumn from './ControlColumn';
import InvitationReport from './InvitationReport';

function SpecialRegTab() {
  return (
    <Container className="special-registration">
      <Row>
        <Col md={3}>
          <ControlColumn />
        </Col>
        <Col md={9}>
          <InvitationReport />
        </Col>
      </Row>
    </Container>
  );
}

export default SpecialRegTab;
