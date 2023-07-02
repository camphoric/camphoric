import React from 'react';
import { Button } from 'react-bootstrap';
import {
  useLodgingLookup,
  useLodgingTree,
  useEvent,
} from 'hooks/api';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';
import LodgingNodeDisplay from './LodgingNodeDisplay';
import LodgingEditForm from './LodgingEditForm';
import { sortedChildren } from '../utils';

function TreeView() {
  const lodgingTree = useLodgingTree();
  const { data: event } = useEvent();
  const lodgingLookup = useLodgingLookup();
  const [show, setShow] = React.useState<boolean>(false);
  const [lodgingToEdit, setLodgingToEdit] = React.useState<AugmentedLodging>();

  if (!lodgingTree || !lodgingLookup || !event) {
    return <Spinner />;
  }

  const showLodgingModal = (l?: AugmentedLodging) => {
    setLodgingToEdit(l);
    setShow(true);
  }

  return (
    <div className="tree-view">
      {
        sortedChildren(lodgingTree).map((c) => (
          <LodgingNodeDisplay
            key={c.id}
            lodgingTree={c}
            showLodgingModal={showLodgingModal}
          />
        ))
      }
      <Button className="new-lodging-button" onClick={() => showLodgingModal()}>Add New Lodging</Button>
      <ShowRawJSON label="lodging" json={lodgingTree} />
      {
        !!show && (
          <LodgingEditForm
            show={show}
            setShow={setShow}
            lodging={lodgingToEdit}
            lodgingLookup={lodgingLookup}
          />
        )
      }
    </div>
  );
}

export default TreeView;
