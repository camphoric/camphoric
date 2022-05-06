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

import {
  useCamperLookup,
  useCamperSearch,
  useEvent,
} from 'store/hooks';

import Spinner from 'components/Spinner';

import CamperSearchResult from './CamperSearchResult';
import CamperEdit from './CamperEdit';

import { useQuery } from 'hooks/navigation';

function EventAdminCampers() {
  const eventApi = useEvent();
  const camperLookup = useCamperLookup();
  const camperSearch = useCamperSearch();

  const camperId = useQuery('camperId');
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!camperSearch || !camperLookup || !eventApi.data) return <Spinner />;

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
                event={eventApi.data}
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
