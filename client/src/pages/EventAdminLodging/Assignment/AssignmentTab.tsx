import React from 'react';
import { Form } from 'react-bootstrap';
import Spinner from 'components/Spinner';
import {
  LodgingLookup,
  useCamperLookup,
  useLodgingLookup,
} from 'hooks/api';

import {
  getDaysArray,
  getLeafNodes,
  getNonLeafNodes,
  sortLodgingNames,
  lodgingIsAncestorOf,
} from '../utils';
import DraggableGrid from './DraggableGrid';

type Props = {
  lodgingTreeNode: AugmentedLodging,
  event: ApiEvent,
  isDragging: boolean,
  activateCamperPopover: (ref: any, camper: ApiCamper) => void,
};

function Assignment({ lodgingTreeNode, ...props }: Props) {
  const [filters, setFilters] = React.useState<Array<string>>([]);
  const camperLookup = useCamperLookup();
  const lodgingLookup = useLodgingLookup();

  if (!lodgingLookup || !camperLookup || !props.event) {
    return <Spinner />;
  }

  const days = getDaysArray(props.event);

  let leaves: LodgingLookup = {
    [lodgingTreeNode.name || '?']: lodgingTreeNode
  };

  if (!lodgingTreeNode.isLeaf) {
    leaves = getLeafNodes(lodgingTreeNode);
  }

  const shouldNotFilter = (
    !filters ||
    !filters.length
  );

  const filterFn = ([_, nodeToCheck]: [a: string, b: AugmentedLodging]) => {
    if (shouldNotFilter) return true;

    return !!filters.find(
      id => lodgingIsAncestorOf(nodeToCheck, id, lodgingLookup)
    );
  };

  const updateFilters = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checkedBoxes = Array.prototype.slice.call(
      document
        ?.querySelector(`#lodging-extra-filters-${lodgingTreeNode.id}`)
        ?.querySelectorAll(':scope .form-check-input')
    ).filter(e => e.checked).map(e => e.value);

    setFilters(checkedBoxes);
  };

  const checkboxes = getNonLeafNodes(lodgingTreeNode).map((f) => (
    <Form.Check
      key={f.id}
      inline
      type="checkbox"
      id={`filter-${f.id}`}
      label={f.name}
      value={f.id}
      onChange={updateFilters}
    />
  ));

  return (
    <div className="scrollable-container lodging-grid-container">
      <div className="lodging-extra-filters" id={`lodging-extra-filters-${lodgingTreeNode.id}`}>
        <div>Filter by:</div>
        {checkboxes}
      </div>
      {
        Object
        .entries(leaves)
        .sort(sortLodgingNames)
        .filter(filterFn)
        .map(([name, l]) => (
          <DraggableGrid
            key={name}
            {...props}
            lodgingTree={l}
            days={days}
            lodgingLookup={lodgingLookup}
            camperLookup={camperLookup}
            activateCamperPopover={props.activateCamperPopover}
          />
        ))
      }
    </div>
  );
}

export default Assignment;
