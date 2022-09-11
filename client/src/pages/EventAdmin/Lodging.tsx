import React from 'react';
import { useLodgingTree } from 'hooks/api';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';
import LodgingNodeDisplay from './LodgingNodeDisplay';


function EventAdminLodging() {
  const lodgingTree = useLodgingTree();

  if (!lodgingTree) {
    return <Spinner />;
  }

  console.log(lodgingTree);

  return (
    <React.Fragment>
      <h1>Lodging</h1>
      {
        lodgingTree.children.map(
          c => <LodgingNodeDisplay lodgingTree={c} />
        )
      }
      <ShowRawJSON label="lodging" json={lodgingTree} />
    </React.Fragment>
  );
}

export default EventAdminLodging;
