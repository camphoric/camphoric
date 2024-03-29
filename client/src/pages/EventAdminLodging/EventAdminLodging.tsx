import React from 'react';
import {
  Tabs, Tab,
  Container, Row, Col,
  Collapse,
  Button,
  Badge,
  Overlay,
} from 'react-bootstrap';
import { IoInformationCircleOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import api, {
  useLodgingLookup,
  useLodgingTree,
  useEvent,
  useCamperLookup,
} from 'hooks/api';
import Spinner from 'components/Spinner';
import { lodgingPathDisplay, getCamperDisplayId } from 'utils/display';
import Assignment from './Assignment';
import CamperPopOver from './CamperPopOver';
import TreeView from './TreeView';

import { getAllParentClasses } from './utils';

export type PopoverTarget = React.ComponentProps<typeof Overlay>['target'] | EventTarget;

function EventAdminLodging() {
  const [patchCamper] = api.useUpdateCamperMutation();
  const [camper, setCamper] = React.useState<ApiCamper>();
  const popupTargetRef = React.useRef<PopoverTarget>();
  const [open, setOpen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const lodgingTree = useLodgingTree();
  const camperLookup = useCamperLookup();
  const { data: event } = useEvent();
  const lodgingLookup = useLodgingLookup();

  if (!lodgingTree || !lodgingLookup || !event) {
    return <Spinner />;
  }

  const activateCamperPopover = (ref: PopoverTarget, c: ApiCamper) => {
    setCamper(c);
    popupTargetRef.current = ref;
  };

  const dismissAllPopovers = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (!e) {
      setCamper(undefined);
      return;
    }

    const allClasses = getAllParentClasses(e.target as HTMLDivElement);

    if (allClasses.includes('camper-tools')) return;
    if (allClasses.includes('camper-pop-over')) return;

    if (!allClasses.includes('camper-pop-over')) setCamper(undefined);
  };

  const unassignCamper = (c: ApiCamper) => {
    const data = {
      id: c.id,
      lodging: null,
      stay: null,
    };

    patchCamper(data);
    dismissAllPopovers();
  };

  const lodgings = Object.values(lodgingLookup);

  const unassignedCampers = lodgings.filter(l => !l.isLeaf).reduce(
    (acc: Array<ApiCamper>, l: AugmentedLodging)  => ([
      ...acc,
      ...l.campers
    ]),
    Object.values(camperLookup || {}).filter(c => !c.lodging),
  );

  const onDragStart = (c: ApiCamper) => (e: React.DragEvent) => {
    e.dataTransfer?.setData('id', c.id.toString());
    setIsDragging(true);
  }

  return (
    <Container
      className="event-admin-lodging-container"
      onClick={dismissAllPopovers}
      onMouseDown={dismissAllPopovers}
    >
      <Row>
        {
          open && (
            <Col
              className="event-admin-left-column-container"
              sm={3}
            >
              <div
                className="sticky-top event-admin-left-column-container-inner"
              >
                <Collapse in={open} dimension="width">
                  <div className="unassigned-camper-list-container">
                    <ul className="unassigned-camper-list">
                      {
                        unassignedCampers.map(
                          (c: ApiCamper) => (
                            <li key={c.id}>
                              <div
                                draggable={true}
                                key={`camper-${c.id}`}
                                data-camperid={c.id}
                                onDragStart={onDragStart(c)}
                                onMouseDown={() => setIsDragging(true)}
                                onMouseLeave={() => setIsDragging(false)}
                                onMouseUp={() => setIsDragging(false)}
                                onDragEnd={() => setIsDragging(false)}
                                className="draggable-camper"
                              >
                                <div className="camper-info"> 
                                  <div className="camper-name">
                                    { getCamperDisplayId(c) }
                                  </div>
                                  <div className="lodging-additional-info">
                                    {
                                      lodgingPathDisplay(lodgingLookup, c.lodging_requested || 0)
                                    }
                                    {
                                      !!c.lodging_shared && (
                                        `, sharing with ${c.lodging_shared_with}`
                                      )
                                    }
                                    {
                                      !!c.lodging_comments && (
                                        <div className="camper-lodging-comments">{c.lodging_comments}</div>
                                      )
                                    }
                                  </div>
                                </div>
                                <div className="camper-tools"
                                  onMouseEnter={(e) => activateCamperPopover(e.target, c)}
                                  onMouseLeave={() => dismissAllPopovers()}
                                >
                                  <IoInformationCircleOutline />
                                </div>
                              </div>
                            </li>
                          )
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
          sm={open ? 9 : 12}
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
                <TreeView />
              </Tab>
              {
                lodgingTree.children.map((l) => (
                  <Tab key={l.id} eventKey={`node-${l.id}`} title={l.name}>
                    <Assignment
                      isDragging={isDragging}
                      event={event}
                      lodgingTree={l}
                      activateCamperPopover={activateCamperPopover}
                    />
                  </Tab>
                ))
              }
            </Tabs>
          </div>
        </Col>
      </Row>
      <CamperPopOver
        popupTargetRef={popupTargetRef}
        camper={camper}
        unassignCamper={unassignCamper}
      />
    </Container>
  );
}

export default EventAdminLodging;
