import React from 'react';
import {
  InputGroup,
  FormControl,
  Container,
  Row,
  Col,
} from 'react-bootstrap';

import Spinner from '../../../../Spinner';

import ShowRawJSON from './ShowRawJSON';
import RegistrationSearchResult from './RegistrationSearchResult';

import { useCombinedEventInfo } from '../../../hooks';

interface Props {
  event: ApiEvent,
}

function EventAdminRegistrations({ event }: Props) {
  let registrations = Object.values(useCombinedEventInfo(event.id));
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!registrations || !registrations.length) return <Spinner />;

  if (searchQuery.length > 2) {
    registrations = registrations.filter(
      r => r.searchStr.includes(searchQuery.toLowerCase())
    );
  }

  return (
    <Container>
      <Row>
        <Col md={3}>
          <InputGroup className="mb-3">
            <FormControl
              placeholder="search"
              aria-label="search"
              onChange={e => setSearchQuery(e.currentTarget.value)}
              
            />
          </InputGroup>
          {
            registrations.map(
              r => (
                <RegistrationSearchResult
                  key={r.id}
                  registration={r}
                  searchQuery={searchQuery}
                />
              )
            )
          }
        </Col>
        <Col>
          <ShowRawJSON label="registrations" json={registrations} />
        </Col>
      </Row>
    </Container>
  );
}

export default EventAdminRegistrations;
