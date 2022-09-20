import React from 'react';
import {
  Tabs, Tab,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import { LodgingLookup, useCamperLookup } from 'hooks/api';
import debug from 'utils/debug';
import {
  getDaysArray,
  getLeafNodes,
  LodgingPair,
  sortLodgingNames,
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
  const { lodgingTree } = props;

  if (!lodgingTree) {
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
            />
          ))
        }
      </>
    );
  };

  if (lodgingTree.isLeaf || leafChildren.length) {
    return (
      <div className="scrollable-container lodging-grid-container">
        { assignmentNodeFactory(lodgingTree) }
      </div>
    );
  }

  return (
    <Tabs defaultActiveKey="View" className="level-2">
      {
        lodgingTree.children.map((l) => (
          <Tab key={l.id} eventKey={`node-${l.id}`} title={l.name}>
            <div className="scrollable-container lodging-grid-container">
              { assignmentNodeFactory(l) }
            </div>
          </Tab>
        ))
      }
    </Tabs>
  );
}

export default Assignment;
