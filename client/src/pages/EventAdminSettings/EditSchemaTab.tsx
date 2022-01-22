import React from 'react';
import {
  Container,
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import JsonEditor from 'components/JsonEditor';

import { TabProps, EditableSchemaKeys } from './EventAdminSettings';

interface Props extends TabProps {
  name: EditableSchemaKeys,
}

function EditSchemaTab(props: Props) {
  const editor = React.useRef<JsonEditor>(null);
  const value = props.event[props.name];

  // console.log(props.name, value);

  if (!value) return <Spinner />;

  const save = () => {
    if (!editor.current) return;

    const newValue = editor.current.getValue()

    props.handleChange(props.name)(newValue);
    props.save();
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
