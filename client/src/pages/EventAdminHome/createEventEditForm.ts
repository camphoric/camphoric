import React from 'react';
import { FormControl } from 'react-bootstrap';

interface FormElementDefinition {
  label: string;
  field: string;
  Input: React.ComponentType<any>;
  passProps: { [idx: string]: any };
}
type Returns = Array<FormElementDefinition>;

export default function createEventEditForm(event: ApiEvent): Returns {
  return [
    {
      label: 'Name',
      field: 'name',
      Input: FormControl,
      passProps: { defaultValue: event.name },
    },
    {
      label: 'Event Starts',
      field: 'start',
      Input: FormControl,
      passProps: {
        type: 'date',
        defaultValue: formatDate(event.start),
      },
    },
    {
      label: 'Event Ends',
      field: 'end',
      Input: FormControl,
      passProps: {
        type: 'date',
        defaultValue: formatDate(event.end),
      },
    },
    {
      label: 'Reg Starts',
      field: 'registration_start',
      Input: FormControl,
      passProps: {
        type: 'date',
        defaultValue: formatDate(event.registration_start),
      },
    },
    {
      label: 'Reg Ends',
      field: 'registration_end',
      Input: FormControl,
      passProps: {
        type: 'date',
        defaultValue: formatDate(event.registration_end),
      },
    },
  ];
}

function formatDate(dateStr: string | null) {
  const date = new Date(dateStr || '');

  if (!date) return undefined;

  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return [year, month, day].join('-');
}
