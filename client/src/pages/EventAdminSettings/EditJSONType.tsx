import React from 'react';
import {
  Container,
  Button,
  FormControl,
  Alert,
} from 'react-bootstrap';
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
  const textRef  = React.useRef<HTMLTextAreaElement>(null);
  const event = eventApi.currentData;

  if (eventApi.isLoading || !event || loading) return <Spinner />;

  const save = async () => {
    const value = textRef.current?.value;

    if (!value) {
      setError('The value must be valid JSON');

      return;
    }

    let json;
    try {
      json = JSON.parse(value)
    } catch (e) {
      setError('The value must be valid JSON');

      return;
    }

    setLoading(true);

    const res = await patchEvent({
      id: event.id,
      [keyToEdit]: json,
    });

    setLoading(false);

    if ('error' in res) {
      setError(res.error);

      return;
    }

    setError(undefined);

    textRef.current.value = JSON.stringify(
      res.data[keyToEdit], null, 2
    );
  }

  return (
    <Container>
      {
        !!error && (
          <Alert variant="danger">{error}</Alert>
        )
      }
      <FormControl
        aria-label={keyToEdit}
        as="textarea"
        rows={20}
        ref={textRef}
        defaultValue={JSON.stringify(event[keyToEdit], null, 2)}
      />
      <Button onClick={save}>Save</Button>
    </Container>
  );
}

export default EditJSONType;
