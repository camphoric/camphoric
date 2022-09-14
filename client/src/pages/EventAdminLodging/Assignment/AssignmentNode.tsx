import React from 'react';
import debug from 'utils/debug';
import { getLeafNodes } from './utils';
import { LodgingLookup } from 'hooks/api';

type Props = {
  lodgingTree: AugmentedLodging,
  event: ApiEvent,
  days: Array<Date>,
};

function AssignmentNode(props: Props) {
  const { lodgingTree, days } = props;

  let leaves: LodgingLookup = {
    [lodgingTree.name || '?']: lodgingTree
  };

  if (!lodgingTree.isLeaf) {
    leaves = getLeafNodes(lodgingTree);
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Lodging</th>
          {
            days.map((dt) => (
              <th>{dt.toLocaleDateString()}</th>
            ))
          }
        </tr>
      </thead>
      <tbody>
      {
        Object
        .entries(leaves)
        .sort((a, b) => {
          const nameA = a[0];
          const nameB = b[0];
          if (nameA < nameB) {
            return -1;
          }
          if (nameA > nameB) {
            return 1;
          }
          // names must be equal
          return 0;
        })
        .map(([title, leaf]) => (
              <tr>
                <td>{title}</td>
                {
                  days.map(dt => (
                      <td>{dt.toLocaleDateString()}</td>
                  ))
                }
              </tr>
        ))
      }
      </tbody>
    </table>
  );
}

export default AssignmentNode;
