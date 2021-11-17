import React from 'react';
import {
  InputGroup,
  FormControl,
  Container,
  Row,
  Col,
} from 'react-bootstrap';
import Fuse from 'fuse.js';

import CamperSearchResult from './CamperSearchResult';
import CamperEdit from './CamperEdit';

import { useQuery } from 'hooks/admin';
// import getAllKeys from 'utils/objectKeys';

function EventAdminCampers(props: EventAdminPageProps) {
  const { event, registrationLookup, registrationSearch } = props;
  const registrationId = useQuery('registrationId');
  const [searchQuery, setSearchQuery] = React.useState('');

  const results = registrationSearch.search(searchQuery);
  // console.log(getAllKeys(props.registrations[0].attributes));
  // console.log(props.registrations[0]);
  // console.log('searchResults', results);

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
              (r: Fuse.FuseResult<AugmentedCamper>) => (
                <CamperSearchResult
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
              <CamperEdit
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

export default EventAdminCampers;
