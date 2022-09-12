import React from 'react';
import { Tooltip, OverlayTrigger, Collapse, Button } from 'react-bootstrap';
import { getCamperDisplayId } from 'utils/display';

type Props = {
  renderNode: (a: AugmentedLodging) => React.ReactNode,
  lodgingTree: AugmentedLodging,
  topLevel: boolean;
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
            <li>{ getCamperDisplayId(c) }</li>
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
        <Button style={{ width: '100%', textAlign: 'left' }} variant="info" onClick={() => setOpen(!open)}>
          {props.lodgingTree.name} ({props.lodgingTree.count} / {props.lodgingTree.capacity})
        </Button>
      </OverlayTrigger>
      <Collapse in={open}>
        <div>
          { props.renderNode(props.lodgingTree) }
          {
            props.lodgingTree.children.map(c => (
              <LodgingNodeDisplay
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
