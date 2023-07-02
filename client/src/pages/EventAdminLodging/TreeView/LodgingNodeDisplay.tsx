import React from 'react';
import { Tooltip, OverlayTrigger, Collapse, Button } from 'react-bootstrap';
import { getCamperDisplayId } from 'utils/display';
import { sortedChildren } from '../utils';

type Props = {
  renderNode: (a: AugmentedLodging) => React.ReactNode,
  lodgingTree: AugmentedLodging,
  topLevel: boolean;
  showLodgingModal: (l: AugmentedLodging) => void,
  deleteLodging: (l: AugmentedLodging) => void,
} & typeof defaultProps;

const defaultProps = {
  renderNode: () => null,
  topLevel: true,
};

function LodgingNodeDisplay(props: Props) {
  const [open, setOpen] = React.useState(false);

  const renderCamperList = (p: any) => props.lodgingTree.campers.length ? (
    <Tooltip id={`camper-list-${props.lodgingTree.id}`} {...p}>
      <ul>
        {
          props.lodgingTree.campers.map(c => (
            <li key={c.id}>{ getCamperDisplayId(c) }</li>
          ))
        }
      </ul>
    </Tooltip>
  ) : <div />;

  return (
    <div style={{ marginLeft: '2rem'}}>
      <OverlayTrigger
        placement="auto"
        delay={{ show: 0, hide: 0 }}
        overlay={renderCamperList}
      >
        <Button className="main-lodging-button" variant="info" onClick={() => setOpen(!open)}>
          <span>
            {props.lodgingTree.name} ({props.lodgingTree.count} / {props.lodgingTree.capacity})
            <span> - Reserved: {props.lodgingTree.reserved}</span>
          </span>
          <div className="lodging-edit-buttons">
            <Button onClick={(e) => {
              e.stopPropagation();
              props.showLodgingModal(props.lodgingTree);
            }}>
              Edit
            </Button>
            <Button variant="danger" onClick={(e) => {
              e.stopPropagation();
              props.deleteLodging(props.lodgingTree);
            }}>
              Delete
            </Button>
          </div>
        </Button>
      </OverlayTrigger>
      <Collapse in={open}>
        <div>
          { props.renderNode(props.lodgingTree) }
          {
            sortedChildren(props.lodgingTree).map(c => (
              <LodgingNodeDisplay
                key={c.id}
                {...props}
                topLevel={false}
                lodgingTree={c}
              />
            ))
          }
        </div>
      </Collapse>
    </div>
  );
}

LodgingNodeDisplay.defaultProps = defaultProps;

export default LodgingNodeDisplay;
