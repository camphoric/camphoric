import React from 'react';
import {
  Tabs, Tab,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import debug from 'utils/debug';
import { getDaysArray, getLeafNodes } from './utils';
import AssignmentNode from './AssignmentNode';

// https://codesandbox.io/s/currying-grass-hz2xc?file=/src/styles.css
//
type Props = {
  lodgingTree: AugmentedLodging,
  event: ApiEvent,
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

  debug('days', days);

  const leafChildren = lodgingTree.children.filter(l => l.isLeaf);

  if (lodgingTree.isLeaf || leafChildren.length) {
    debug('isLeaf');
    return (
      <div className="scrollable-container lodging-grid-container">
        <AssignmentNode {...props} days={days} />
      </div>
    );
  }

  debug('NOT isLeaf');
  return (
    <Tabs defaultActiveKey="View" className="level-2">
      {
        lodgingTree.children.map((l) => (
          <Tab key={l.id} eventKey={`node-${l.id}`} title={l.name}>
            <div className="scrollable-container lodging-grid-container">
              <AssignmentNode
                {...props}
                days={days}
                lodgingTree={l}
              />
            </div>
          </Tab>
        ))
      }
    </Tabs>
  );
}

export default Assignment;
