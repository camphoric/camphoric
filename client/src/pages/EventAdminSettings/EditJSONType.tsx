import React from 'react';
import {
  Container,
  Alert,
} from 'react-bootstrap';
import JsonEditor, { type Content } from 'components/JsonEditor';
import Spinner from 'components/Spinner';

import api, { useEvent } from 'hooks/api';

import { TabProps } from './EventAdminSettings';

interface Props extends TabProps {
  keyToEdit: keyof ApiEvent;
}

function EditJSONType({ keyToEdit }: Props) {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>();
  const [patchEvent] = api.useUpdateEventMutation();
  const eventApi = useEvent();

  const event = eventApi.currentData;

  if (eventApi.isLoading || !event || loading) return <Spinner />;

  const save = async (val: Content) => {
    console.log('onSave', val);

    let newValue;

    if ('text' in val && !!val.text) {
      newValue = JSON.parse(val.text)
    } else if ('json' in val && !!val.json) {
      newValue = val.json;
    }

    if (!newValue) return;
    setLoading(true);

    const res = await patchEvent({
      id: event.id,
      [keyToEdit]: newValue,
    });

    setLoading(false);

    if ('error' in res) {
      setError(res.error);

      return;
    }

    setError(undefined);
  }

  return (
    <Container>
      {
        !!error && (
          <Alert variant="danger">{error}</Alert>
        )
      }
      <JsonEditor
        content={{ json: event[keyToEdit] }}
        onSave={save}
      />
    </Container>
  );
}

export default EditJSONType;
