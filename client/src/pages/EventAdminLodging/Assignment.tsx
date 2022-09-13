import React from 'react';
import { useLodgingTree } from 'hooks/api';
import {
  Tabs, Tab,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';
import debug from 'utils/debug';


function Assignment() {
  const lodgingTree = useLodgingTree();

  if (!lodgingTree) {
    return <Spinner />;
  }

  debug('lodgingTree', lodgingTree);

  return (
    <Tabs defaultActiveKey="View">
      <Tab eventKey="View" title="View">
        Stuff

        <ShowRawJSON label="lodging" json={lodgingTree} />
      </Tab>
      <Tab eventKey="Assign" title="Assign">
        <div>coming soon</div>
      </Tab>

    </Tabs>
  );
}

export default Assignment;
