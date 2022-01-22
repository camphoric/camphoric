import React from 'react';
import {
  Container,
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';

import { apiFetch } from 'utils/fetch';

import { TabProps } from './EventAdminSettings';

interface Props extends TabProps {
}

function EditRegistrationTypes({ event, ...props }: Props) {
  const [registrationTypes, setRegistrationTypes] = React.useState<ApiRegistrationType[] | null>(null);

  const getRegistrationTypes = async () => {
    try {
      const response = await apiFetch('/api/registrationtypes/');
      const json = await response.json();

      setRegistrationTypes(json);
    } catch (error) {
      console.log('error', error);
    }
  };

  React.useEffect(() => {
    getRegistrationTypes();
  }, [event.id]);
  // console.log(props.name, value);

  if (!registrationTypes) return <Spinner />;

  console.log(registrationTypes);

  const save = () => { }
  const postNew = () => { }

  return (
    <Container>
      <Button onClick={save}>Save</Button>
      <Button onClick={postNew}>new</Button>
    </Container>
  );
}

export default EditRegistrationTypes;
