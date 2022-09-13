import React from 'react';
import { useLodgingTree } from 'hooks/api';
import {
  Tabs, Tab,
  Container, Row, Col,
  Collapse,
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';
import LodgingNodeDisplay from './LodgingNodeDisplay';
import Assignment from './Assignment';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

function EventAdminLodging() {
  const [open, setOpen] = React.useState(false);
  const lodgingTree = useLodgingTree();

  if (!lodgingTree) {
    return <Spinner />;
  }

  return (
    <Container className="event-admin-lodging-container">
      <Row>
        {
          open && (
            <Col md="auto" className="event-admin-unassigned-container">
              <div>
                <Collapse in={open} dimension="width">
                  <div>
                    side
                  </div>
                </Collapse>
              </div>
            </Col>
          )
        }
        <Col>
          <Button
            onClick={() => setOpen(!open)}
            aria-controls="example-collapse-text"
            aria-expanded={open}
            className="show-unassigned-button"
          ><div>
            Unassigned { open ? <IoChevronBack /> : <IoChevronForward /> }
          </div></Button>
          <div className="tab-container">
            <Tabs defaultActiveKey="View">
              <Tab eventKey="View" title="Tree View">
                {
                  lodgingTree.children.map(
                    c => <LodgingNodeDisplay key={c.id} lodgingTree={c} />
                  )
                }
                <ShowRawJSON label="lodging" json={lodgingTree} />
              </Tab>
              {
                lodgingTree.children.map((l) => (
                  <Tab key={l.id} eventKey={`node-${l.id}`} title={l.name}>
                    <Assignment />
                  </Tab>
                ))
              }
            </Tabs>
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default EventAdminLodging;
