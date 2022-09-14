import React from 'react';
import {
  Tabs, Tab,
  Container, Row, Col,
  Collapse,
  Button,
  Badge,
} from 'react-bootstrap';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { 
  useLodgingLookup,
  useLodgingTree,
  useEvent,
} from 'hooks/api';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';
import { getCamperDisplayId } from 'utils/display';
import LodgingNodeDisplay from './LodgingNodeDisplay';
import Assignment from './Assignment';

function EventAdminLodging() {
  const [open, setOpen] = React.useState(false);
  const lodgingTree = useLodgingTree();
  const { data: event } = useEvent();
  const lodgingLookup = useLodgingLookup();

  if (!lodgingTree || !lodgingLookup || !event) {
    return <Spinner />;
  }

  const lodgings = Object.values(lodgingLookup);

  const unassignedCampers = lodgings.filter(l => !l.isLeaf).reduce(
    (acc: Array<ApiCamper>, l: AugmentedLodging)  => ([
      ...acc,
      ...l.campers
    ]),
    []
  );

  return (
    <Container className="event-admin-lodging-container">
      <Row>
        {
          open && (
            <Col
              className="event-admin-left-column-container"
              sm={3}
            >
              <div>
                <Collapse in={open} dimension="width">
                  <div>
                    <ul>
                      {
                        unassignedCampers.map(
                          (c: ApiCamper) => (<li>{ getCamperDisplayId(c) }</li>)
                        )
                      }
                    </ul>
                  </div>
                </Collapse>
              </div>
            </Col>
          )
        }
        <Col
          className="event-admin-right-column-container"
          sm={open ? 9 : 'auto'}
        >
          <Button
            onClick={() => setOpen(!open)}
            aria-controls="example-collapse-text"
            aria-expanded={open}
            className="show-unassigned-button"
          ><div className="show-unassigned-button-inner">
            <Badge variant="light">{unassignedCampers.length}</Badge>
            <span>Unassigned</span> { open ? <IoChevronBack /> : <IoChevronForward /> }
          </div></Button>
          <div className="tab-container">
            <Tabs defaultActiveKey="View" className="level-1">
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
                    <Assignment event={event} lodgingTree={l} />
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
