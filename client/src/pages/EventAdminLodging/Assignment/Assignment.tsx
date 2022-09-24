import React from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import Spinner from 'components/Spinner';

import debug from 'utils/debug';

import AssignmentTab from './AssignmentTab';

type Props = {
  lodgingTree: AugmentedLodging,
  event: ApiEvent,
  isDragging: boolean,
  activateCamperPopover: (ref: any, camper: ApiCamper) => void,
};

function Assignment({ lodgingTree, ...props }: Props) {
  if (!lodgingTree || !props.event) {
    return <Spinner />;
  }

  if (!props.event.start || !props.event.end) {
    return (
      <div>
        <h1>No start/end date set</h1>
        <p>Go to the event home and set an event start/end date to continue</p>
      </div>
    );
  }

  const leafChildren = lodgingTree.children.filter(l => l.isLeaf);

  if (lodgingTree.isLeaf || leafChildren.length) {
    return (
      <AssignmentTab
        lodgingTreeNode={lodgingTree}
        {...props}
      />
    );
  }

  return (
    <Tabs defaultActiveKey={`node-${lodgingTree.children[0].id}`} className="level-2">
      {
        lodgingTree.children.map((l) => {
          return (
            <Tab key={l.id} eventKey={`node-${l.id}`} title={l.name}>
              <AssignmentTab
                lodgingTreeNode={l}
                {...props}
              />
            </Tab>
          )
        })
      }
    </Tabs>
  );
}

export default Assignment;
