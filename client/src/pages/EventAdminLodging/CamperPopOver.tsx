import React from 'react';
import {
  Overlay,
  Card,
  Button,
} from 'react-bootstrap';
import {
  useLodgingLookup,
  useRegistrationLookup,
} from 'hooks/api';

import Table from 'components/Table';
import { lodgingPathDisplay, getCamperDisplayId } from 'utils/display';

import type { PopoverTarget } from './EventAdminLodging';

export type Placement = React.ComponentProps<typeof Overlay>['placement'];

interface Props {
  camper?: ApiCamper;
  popupTargetRef?: React.MutableRefObject<PopoverTarget | undefined>;
  unassignCamper: (c: ApiCamper) => void;
  placement?: Placement;
};

function CamperPopOver({ camper, popupTargetRef, ...props }: Props) {
  const lodgingLookup = useLodgingLookup();
  const registrationLookup = useRegistrationLookup();

  if (
    !camper ||
    !popupTargetRef?.current ||
    !lodgingLookup ||
    !registrationLookup
  ) return <div />;

  const unassignCamper = () => props.unassignCamper(camper);

  return (
    <Overlay
      rootClose
      show
      placement={props.placement || 'right-start'}
      // @ts-ignore really event targets also work
      target={popupTargetRef.current}
      onHide={() => undefined}
    >
      {({ placement, arrowProps, show: _show, popper, ...props }) => (
        <div {...props} className="camper-pop-over">
          <Card>
            <Card.Header className="draggable-camper">
              <div className="camper-name">{getCamperDisplayId(camper)}</div>
              <div className="camper-tools">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={unassignCamper}
                >Unassign</Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table
                data={[
                  ['Lodging requested', lodgingPathDisplay(lodgingLookup, camper.lodging_requested || 0) || 'None'],
                  ['Sharing', camper.lodging_shared ? 'Yes' : 'No'],
                  ['Sharing with', camper.lodging_shared_with],
                  ...Object.entries(camper.attributes),
                ]}
              />
              <Card.Title>Registration Notes</Card.Title>
              {
                registrationLookup[camper.registration]?.attributes.notes || '(No notes)'
              }
            </Card.Body>
          </Card>
        </div>
      )}
    </Overlay>
  );
}

export default CamperPopOver;
