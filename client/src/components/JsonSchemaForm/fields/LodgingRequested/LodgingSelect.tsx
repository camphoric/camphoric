import React from 'react';
import { FieldProps } from '@rjsf/core';
import type {
  LodgingNode,
  LodgingArray,
} from './LodgingRequested';

type Props = {
  node: LodgingNode,
  nodes: LodgingArray,
  onValueChange: (a: number, i: number) => void,
  value: number | undefined,
  fieldProps: FieldProps,
  index: number,
};

function LodgingSelect(props: Props) {
  const { SelectWidget } = props.fieldProps.registry.widgets;

  const options = {
    enumOptions: props.nodes
      .filter(n => n.parent === props.node.id)
      .map(n => {
        let label = n.name;

        // label full if no remaining capacity
        if (n.remaining_unreserved_capacity  <= 0) {
          label = `${n.name} (full)`;
        }

        return {
          label,
          value: n.id,
        };
      }),
    // disable option if no remaining capacity
    enumDisabled: props.nodes
      .filter(n => (n.remaining_unreserved_capacity  <= 0))
      .map(n => n.id),
    emptyValue: '',
  }

  const baseId = props.fieldProps.idSchema.choices.$id;

  return (
    <SelectWidget
      {...props.fieldProps}
      placeholder={props.node.children_title || ''}
      id={`${baseId}_${props.node.id}`}
      label={' '}
      value={props.value}
      onChange={(v) => props.onValueChange(Number(v), props.index)}
      options={options}
      rawErrors={[]}
      multiple={false}
    />
  );
}

export default LodgingSelect;
