import React from 'react';
import GridLayout, { ItemCallback, ReactGridLayoutProps } from 'react-grid-layout';
import { IoSettings } from 'react-icons/io5';
import { getCamperDisplayId } from 'utils/display';

import moment from 'moment';
import { formatDateValue } from 'utils/time';
import api, {
  CamperLookup,
  LodgingLookup,
} from 'hooks/api';

import debug from 'utils/debug';

import 'react-grid-layout/css/styles.css';
import './styles.scss';

type Props = {
  lodgingTree: AugmentedLodging,
  lodgingLookup: LodgingLookup,
  camperLookup: CamperLookup,
  event: ApiEvent,
  days: Array<Date>,
  activateCamperPopover: (ref: any, camper: ApiCamper) => void,
  isDragging: boolean,
};

export type OnDropCallback = ReactGridLayoutProps['onDrop'];
export type ResizeHandles = ReactGridLayoutProps['resizeHandles'];

const draggableProps = {
  minH: 1,
  maxH: 1,
  draggable: true,
  isBounded: true,
};

const formatDate = (date: Date) => {
  return moment(date).utcOffset(0).format('dd MM/D');
}

const translatePositionToDates = (days: Props['days'], layout: GridLayout.Layout) => {
  const start = layout.x;
  const length = layout.w;

  const daysSlice = days.slice(start, start + length)

  return daysSlice.map(
    d => formatDateValue(d)
  );
};

const camperGridData = (c: ApiCamper, dayStrings: Array<string>) => {
  if (!Array.isArray(c.stay)) return defaultGridData;

  return {
    x: dayStrings.indexOf(c.stay[0]),
    w: c.stay.length,
    y: 1,
    h: 1 ,
  };
}

const defaultGridData = { x: 0, y: 1, w: 1, h: 1 };
const resizeHandles: ResizeHandles = ['e'];
const cellWidth = 100;

function AssignmentNode(props: Props) {
  const [patchCamper] = api.useUpdateCamperMutation();
  const title = props.lodgingTree.name;
  const { days } = props;
  const campers = props.lodgingTree.campers;
  const dayStrings = days.map(d => formatDateValue(d.toISOString()));
  const defaultStay = props.event.default_stay_length;

  const updateCamper = (camperId: string, layoutItem: GridLayout.Layout) => {
    const data = {
      id: parseInt(camperId, 10),
      lodging: props.lodgingTree.id,
      stay: translatePositionToDates(props.days, layoutItem),
    };

    patchCamper(data);
  };

  const onDrop: OnDropCallback = (layout, layoutItem, e: DragEvent) => {
    const camperId = e.dataTransfer?.getData('id') || '1';

    updateCamper(camperId, {
      ...layoutItem,
      w: defaultStay,
    });
  };

  const onCamperMove: ItemCallback = (layout, before, after) => {
    const camperId = after.i.split('-').pop() || '1';

    updateCamper(camperId, after);
  };

  return (
    <div
      className="assignment-grid"
      style={{
        width: cellWidth * (days.length + 1),
      }}
    >
      <div className="title-container">{title}</div>
      <GridLayout
        cols={days.length}
        isDroppable={true}
        rowHeight={30}
        width={cellWidth * days.length}
        resizeHandles={resizeHandles}
        onDrop={onDrop}
        onDragStop={onCamperMove}
        onResizeStop={onCamperMove}
      >
        {
          days.map((dt, i) => (
            <div
              key={`date${i}`}
              data-grid={{ x: i, y: 0, w: 1, h: 1, static: true }}
              className={props.isDragging ? 'date-box drop-zone' : 'date-box'}
            >
              <div>{formatDate(dt)}</div>
            </div>
          ))
        }
        {
          // NOTE: This doesn't work if you try to split it out into a separate
          // file/component.  It doesn't work with react-grid-layout.
          campers.map((c) => (
            <div
              {...draggableProps}
              key={`camper-${c.id}`}
              className="draggable-camper"
              data-grid={camperGridData(c, dayStrings)}
            >
              <div className="camper-name">{getCamperDisplayId(c)}</div>
              <div className="camper-tools"
                onClick={(e) => props.activateCamperPopover(e.target, c)}
              >
                <IoSettings />
              </div>
            </div>
          ))
        }
      </GridLayout>
    </div>
  );
}


export default AssignmentNode;
