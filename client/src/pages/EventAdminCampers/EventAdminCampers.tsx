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

import CamperSearchResult from './CamperSearchResult';
import CamperEdit from './CamperEdit';

import { useQuery } from 'hooks/admin';
// import getAllKeys from 'utils/objectKeys';

function EventAdminCampers(props: EventAdminPageProps) {
  const { event, camperLookup, camperSearch } = props;
  const camperId = useQuery('camperId');
  const [searchQuery, setSearchQuery] = React.useState('');

  let results;
  if (searchQuery.length) {
    results = camperSearch.search(searchQuery);
  } else {
    results = fuseUtils.getFirstNOf(camperSearch, 10);
  }

  return (
    <Container>
      <Row>
        <Col md={3} className="camper-results">
          <InputGroup className="mb-3">
            <FormControl
              placeholder="search"
              aria-label="search"
              onChange={e => setSearchQuery(e.currentTarget.value)}
            />
          </InputGroup>
          {
            results.map(
              (c: Fuse.FuseResult<ApiCamper>) => (
                <CamperSearchResult
                  key={c.item.id}
                  result={c}
                  selected={c.item.id.toString() === camperId}
                />
              )
            )
          }
        </Col>
        <Col md="9">
          {
            !!camperLookup[camperId] && (
              <CamperEdit
                event={event}
                camper={camperLookup[camperId]}
              />
            )
          }
        </Col>
      </Row>
    </Container>
  );
}

export default EventAdminCampers;
