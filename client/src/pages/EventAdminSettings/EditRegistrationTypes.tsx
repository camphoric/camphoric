import React from 'react';
import {
  Container,
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';

import api from 'store/api';

import { TabProps } from './EventAdminSettings';

interface Props extends TabProps {
}

function EditRegistrationTypes({ event, ...props }: Props) {
  const registrationTypesApi = api.useGetRegistrationTypesQuery();

  if (registrationTypesApi.isLoading || !registrationTypesApi.data) return <Spinner />;

  const registrationTypes = registrationTypesApi.data;

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
