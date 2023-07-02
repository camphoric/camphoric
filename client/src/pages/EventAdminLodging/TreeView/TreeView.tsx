import React from 'react';
import { Button } from 'react-bootstrap';
import api, {
  useLodgingLookup,
  useLodgingTree,
  useEvent,
} from 'hooks/api';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import Spinner from 'components/Spinner';
import ShowRawJSON from 'components/ShowRawJSON';
import LodgingNodeDisplay from './LodgingNodeDisplay';
import LodgingEditForm from './LodgingEditForm';
import { sortedChildren } from '../utils';

function TreeView() {
  const lodgingTree = useLodgingTree();
  const { data: event } = useEvent();
  const lodgingLookup = useLodgingLookup();
  const [showLodgingEditModal, setShowLodgingEditModal] = React.useState<boolean>(false);
  const [lodgingToEdit, setLodgingToEdit] = React.useState<AugmentedLodging>();
  const [lodgingToDelete, setLodgingToDelete] = React.useState<AugmentedLodging>();
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const [deleteLodgingApi] = api.useDeleteLodgingMutation();

  if (!lodgingTree || !lodgingLookup || !event) {
    return <Spinner />;
  }

  const showLodgingModal = (l?: AugmentedLodging) => {
    setLodgingToEdit(l);
    setShowLodgingEditModal(true);
  }

  const deleteLodging = (l: AugmentedLodging) => {
    setLodgingToDelete(l);
    deleteModal.current?.show();
  }

  return (
    <div className="tree-view">
      {
        sortedChildren(lodgingTree).map((c) => (
          <LodgingNodeDisplay
            key={c.id}
            lodgingTree={c}
            showLodgingModal={showLodgingModal}
            deleteLodging={deleteLodging}
          />
        ))
      }
      <Button className="new-lodging-button" onClick={() => showLodgingModal()}>Add New Lodging</Button>
      <ShowRawJSON label="lodging" json={lodgingTree} />
      {
        !!showLodgingEditModal && (
          <LodgingEditForm
            show={showLodgingEditModal}
            setShow={setShowLodgingEditModal}
            lodging={lodgingToEdit}
            lodgingLookup={lodgingLookup}
          />
        )
      }
      <ConfirmDialog
        ref={deleteModal}
        title={`Delete Lodging ${lodgingToDelete?.fullPath}?`}
        onConfirm={async () => {
          if (!lodgingToDelete) return;

          await deleteLodgingApi(lodgingToDelete);
          setLodgingToDelete(undefined);
        }}
      />
    </div>
  );
}

export default TreeView;
