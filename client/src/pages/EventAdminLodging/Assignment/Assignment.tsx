import React from 'react';
import {
  Tabs, Tab,
  Card, Overlay
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import debug from 'utils/debug';
import api, {
  LodgingLookup,
  useCamperLookup,
  useLodgingLookup,
} from 'hooks/api';
import { getCamperDisplayId } from 'utils/display';

import {
  getDaysArray,
  getLeafNodes,
  LodgingPair,
  sortLodgingNames,
  getAllParentClasses 
} from './utils';
import AssignmentNode from './AssignmentNode';

// https://codesandbox.io/s/currying-grass-hz2xc?file=/src/styles.css
//
type Props = {
  lodgingTree: AugmentedLodging,
  event: ApiEvent,
  isDragging: boolean,
};

function Assignment(props: Props) {
  const [camper, setCamper] = React.useState<ApiCamper>();
  const draggableRef = React.useRef<HTMLDivElement>();
  const camperLookup = useCamperLookup();
  const lodgingLookup = useLodgingLookup();
  const { lodgingTree } = props;

  if (!lodgingTree || !lodgingLookup || !camperLookup) {
    return <Spinner />;
  }

  const startDate = props.event.start;
  const endDate = props.event.end;

  if (!startDate || !endDate) {
    return (
      <div>
        <h1>No start/end date set</h1>
        <p>Go to the event home and set an event start/end date to continue</p>
      </div>
    );
  }

  const activateCamperPopover = (ref: HTMLDivElement, c: ApiCamper) => {
    debug('activateCamperPopover', ref, c);
    setCamper(c);
    draggableRef.current = ref;
  };

  const days = getDaysArray(startDate, endDate);

  const leafChildren = lodgingTree.children.filter(l => l.isLeaf);

  const assignmentNodeFactory = (lt: AugmentedLodging) => {
    let leaves: LodgingLookup = {
      [lt.name || '?']: lt
    };

    if (!lodgingTree.isLeaf) {
      leaves = getLeafNodes(lodgingTree);
    }

    return (
      <>
        {
          Object
          .entries(leaves)
          .sort(sortLodgingNames)
          .map(([name, l]) => (
            <AssignmentNode
              key={name}
              {...props}
              lodgingTree={l}
              days={days}
              lodgingLookup={lodgingLookup}
              camperLookup={camperLookup}
              activateCamperPopover={activateCamperPopover}
            />
          ))
        }
      </>
    );
  };

  const popOver = (
    // @ts-ignore draggableRef.current will always be valid when it matters
    <Overlay rootClose target={draggableRef.current} show={!!camper} placement="right">
      {({ placement, arrowProps, show: _show, popper, ...props }) => (
        <div {...props} className="camper-pop-over">
          <Card>
            <Card.Header>{camper && getCamperDisplayId(camper)}</Card.Header>
            <Card.Body>
              With supporting text below as a natural lead-in to additional content.
            </Card.Body>
          </Card>
        </div>
      )}
    </Overlay>
  );

  const dismissAllPopovers = (e: React.MouseEvent<HTMLDivElement>) => {
    const allClasses = getAllParentClasses(e.target as HTMLDivElement);

    if (allClasses.includes('camper-tools')) return;
    if (allClasses.includes('camper-pop-over')) return;

    if (!allClasses.includes('camper-pop-over')) setCamper(undefined);
  }


  if (lodgingTree.isLeaf || leafChildren.length) {
    return (
      <div
        className="scrollable-container lodging-grid-container"
        onClick={dismissAllPopovers}
        onMouseDown={dismissAllPopovers}
      >
        { assignmentNodeFactory(lodgingTree) }
        { popOver}
      </div>
    );
  }

  return (
    <Tabs defaultActiveKey="View" className="level-2">
      {
        lodgingTree.children.map((l) => (
          <Tab key={l.id} eventKey={`node-${l.id}`} title={l.name}>
            <div
              className="scrollable-container lodging-grid-container"
              onClick={dismissAllPopovers}
              onMouseDown={dismissAllPopovers}
            >
              { assignmentNodeFactory(l) }
            </div>
          </Tab>
        ))
      }
      { popOver}
    </Tabs>
  );
}

export default Assignment;
