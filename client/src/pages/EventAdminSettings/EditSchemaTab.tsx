import React from 'react';
import {
  Container,
  Button,
} from 'react-bootstrap';
import api from 'hooks/api';
import Spinner from 'components/Spinner';
import JsonEditor from 'components/JsonEditor';

import { TabProps, EditableSchemaKeys } from './EventAdminSettings';

interface Props extends TabProps {
  name: EditableSchemaKeys,
}

function EditSchemaTab(props: Props) {
  const editor = React.useRef<JsonEditor>(null);
  const [updateEvent] = api.useUpdateEventMutation();
  const value = props.event[props.name];

  if (!value) return <Spinner />;

  const save = () => {
    if (!editor.current) return;

    const newValue = editor.current.getValue()

    updateEvent({
      [props.name]: newValue,
      id: props.event.id,
    });
  }

  return (
    <Container>
      <JsonEditor
        json={value}
        ref={editor}
      />
      <Button onClick={save}>Save</Button>
    </Container>
  );
}

export default EditSchemaTab;
