import React from 'react';
import {
  InputGroup,
  FormControl,
  Container,
  Row,
  Col,
} from 'react-bootstrap';
import Fuse from 'fuse.js';
import * as fuseUtils from 'utils/fuse';

import RegistrationSearchResult from './RegistrationSearchResult';
import RegistrationEdit from './RegistrationEdit';

import { useQuery } from 'hooks/admin';
// import getAllKeys from 'utils/objectKeys';

function EventAdminRegistrations(props: EventAdminPageProps) {
  const { event, registrationLookup, registrationSearch } = props;
  const registrationId = useQuery('registrationId');
  const [searchQuery, setSearchQuery] = React.useState('');

  let results;
  if (searchQuery.length) {
    results = registrationSearch.search(searchQuery);
  } else {
    results = fuseUtils.getFirstNOf(registrationSearch, 10);
  }

  return (
    <Container>
      <Row>
        <Col md={3} className="registration-results">
          <InputGroup className="mb-3">
            <FormControl
              placeholder="search"
              aria-label="search"
              onChange={e => setSearchQuery(e.currentTarget.value)}
            />
          </InputGroup>
          {
            results.map(
              (r: Fuse.FuseResult<AugmentedRegistration>) => (
                <RegistrationSearchResult
                  key={r.item.id}
                  result={r}
                  selected={r.item.id.toString() === registrationId}
                />
              )
            )
          }
        </Col>
        <Col md="9">
          {
            !!registrationLookup[registrationId] && (
              <RegistrationEdit
                event={event}
                registration={registrationLookup[registrationId]}
              />
            )
          }
        </Col>
      </Row>
    </Container>
  );
}

export default EventAdminRegistrations;
