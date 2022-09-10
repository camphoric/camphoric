import React from 'react';
import { Collapse, Button } from 'react-bootstrap';
import { type LodgingNode } from 'hooks/api';
import { getCamperDisplayId } from 'utils/display';

type Props = {
  renderNode: (a: LodgingNode) => React.ReactNode,
  lodgingTree: LodgingNode,
  topLevel: boolean;
} & typeof defaultProps;

const defaultProps = {
  renderNode: () => null,
  topLevel: true,
};

function LodgingNodeDisplay(props: Props) {
  const [open, setOpen] = React.useState(props.topLevel);
  
  return (
    <div style={{ marginLeft: '2rem'}}>
      <Button style={{ width: '100%', textAlign: 'left' }} variant="info" onClick={() => setOpen(!open)}>
        {props.lodgingTree.name} ({props.lodgingTree.count} / {props.lodgingTree.capacity})
      </Button>
      <Collapse in={open}>
        <div>
          { props.renderNode(props.lodgingTree) }
          <ul>
            {
              props.lodgingTree.campers.map(c => (
                <li>{ getCamperDisplayId(c) }</li>
              ))
            }
          </ul>
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
