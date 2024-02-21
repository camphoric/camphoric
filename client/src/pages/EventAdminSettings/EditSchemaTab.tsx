import React from 'react';
import {
  Container,
} from 'react-bootstrap';
import api from 'hooks/api';
import Spinner from 'components/Spinner';
import JsonEditor, { type Content } from 'components/JsonEditor';

import { TabProps, EditableSchemaKeys } from './EventAdminSettings';

interface Props extends TabProps {
  name: EditableSchemaKeys,
}

function EditSchemaTab(props: Props) {
  const [updateEvent] = api.useUpdateEventMutation();
  const value = props.event[props.name];

  if (!value) return <Spinner />;

  const save = (val: Content) => {
    console.log('onSave', val);

    let newValue;

    if ('text' in val && !!val.text) {
      newValue = JSON.parse(val.text)
    } else if ('json' in val && !!val.json) {
      newValue = val.json;
    }

    if (!newValue) return;

    updateEvent({
      [props.name]: newValue,
      id: props.event.id,
    });
  }

  return (
    <Container>
      <JsonEditor
        content={{ json: value }}
        onSave={save}
      />
    </Container>
  );
}

export default EditSchemaTab;
