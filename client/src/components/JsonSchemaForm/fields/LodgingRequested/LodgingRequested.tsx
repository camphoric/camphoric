import React from 'react';
import { FieldProps } from '@rjsf/core';

import LodgingSelect from './LodgingSelect';

export type LodgingNode = {
  id: number,
  event: number,
  parent: number | null,
  name: string,
  children_title: string,
  capacity: number,
  reserved: number,
  camper_count_adjusted: number,
  remaining_unreserved_capacity: number,
  visible: boolean,
  sharing_multiplier: number,
  notes: string,
};

export type ChildLodgingNode = LodgingNode & {
  parent: number,
};

export type RootLodgingNode = LodgingNode & {
  parent: null,
};

export type LodgingArray = Array<LodgingNode>;

function LodgingRequestedField(props: FieldProps) {
  const nodes = props.uiSchema.lodging_nodes as LodgingArray;
  const root = nodes.find((n) => !n.parent) as RootLodgingNode;
  const choices = props.formData.choices?.filter(Boolean) || [] as Array<number>;

  console.log('LodgingRequestedField props', props);

  const isLeaf = (id: number) => 
    !nodes.find(n => n.parent === id);

  const onValueChange = (value: number, index: number) => {
    const newChoices = [
      ...choices.slice(0, index),
      value,
    ];

    const name = nodes.find(n => n.id === value)?.name;

    const newFormData = {
      id: isLeaf(value) ? value : undefined, 
      name: isLeaf(value) ? name : undefined, 
      choices: newChoices,
    };

    console.log('LodgingRequestedField onChange value', newFormData);

    props.onChange(newFormData);
  };

  return (
    <div
      id="field-lodging-requested-container"
      className="field-lodging-requested"
    >
      <LodgingSelect
        fieldProps={props}
        node={root}
        nodes={nodes}
        value={choices[0]}
        onValueChange={onValueChange}
        index={0}
      />
      {
        choices
        .map((nid: number) => nodes.find(n => n.id === nid))
        .map(
          (n: LodgingNode, i: number) => {
            if (isLeaf(n.id)) return null;

            return (
              <LodgingSelect
                key={n.id}
                fieldProps={props}
                node={n}
                nodes={nodes}
                value={choices[i + 1]}
                onValueChange={onValueChange}
                index={i + 1}
              />
            );
          }
        )
      }
    </div>
  );
}

export default LodgingRequestedField;
