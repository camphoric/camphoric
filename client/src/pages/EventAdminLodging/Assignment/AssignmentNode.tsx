import React from 'react';
import GridLayout, { ItemCallback, ReactGridLayoutProps } from 'react-grid-layout';
import { IoSettings } from 'react-icons/io5';
import { getCamperDisplayId } from 'utils/display';

import moment from 'moment';
import debug from 'utils/debug';
import { formatDateValue } from 'utils/time';
import api, { useCamperLookup } from 'hooks/api';

import 'react-grid-layout/css/styles.css';
import './styles.scss';

type Props = {
  lodgingTree: AugmentedLodging,
  event: ApiEvent,
  days: Array<Date>,
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
  return moment(date).format('dd MM/D');
}

const translatePositionToDates = (days: Props['days'], layout: GridLayout.Layout) => {
  const start = layout.x;
  const length = layout.w;

  const daysSlice = days.slice(start, start + length)

  return daysSlice.map(
    d => formatDateValue(d)
  );
}

const resizeHandles: ResizeHandles = ['e'];

function AssignmentNode(props: Props) {
  const camperLookup = useCamperLookup();
  const [patchCamper] = api.useUpdateCamperMutation();

  const updateCamper = (camperId: string, layoutItem: GridLayout.Layout) => {
    if (!camperLookup) return;

    const data = {
      id: parseInt(camperId, 10),
      lodging: props.lodgingTree.id,
      stay: translatePositionToDates(props.days, layoutItem),
    };

    debug('UPDATE camperData', data);

    patchCamper(data);
  };

  const onDrop: OnDropCallback = (layout, layoutItem, e: DragEvent) => {
    const camperId = e.dataTransfer?.getData('id') || '1';

    updateCamper(camperId, layoutItem);
  };

  const title = props.lodgingTree.name;
  const { days } = props;

  const campers = props.lodgingTree.campers;

  const onCamperMove: ItemCallback = (layout, before, after) => {
    const camperId = after.i.split('-').pop() || '1';

    updateCamper(camperId, after);
  };

  const dayStrings = days.map(d => formatDateValue(d.toISOString()));

  const defaultGridData = { x: 0, y: 1, w: 1, h: 1 };
  const camperGridData = (c: ApiCamper) => {
    if (!Array.isArray(c.stay)) return defaultGridData;

    return {
      x: dayStrings.indexOf(c.stay[0]),
      w: c.stay.length,
      y: 1,
      h: 1 ,
    };
  }

  return (
    <div className="assignment-grid">
      <div className="title-container">{title}</div>
      <GridLayout
        cols={days.length}
        useCSSTransforms={false}
        isDroppable={true}
        rowHeight={30}
        width={950}
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
          campers.map((c) => (
            <div
              {...draggableProps}
              key={`camper-${c.id}`} 
              className="draggable-camper"
              data-grid={camperGridData(c)}
            >
              <div className="camper-name">{getCamperDisplayId(c)}</div>
              <div className="camper-tools">
                <IoSettings onClick={() => alert('bob')} />
              </div>
            </div>
          ))
        }
      </GridLayout>
    </div>
  );
}


export default AssignmentNode;
