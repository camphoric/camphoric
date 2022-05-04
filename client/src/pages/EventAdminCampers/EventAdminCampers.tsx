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
} from 'store/hooks';

import Spinner from 'components/Spinner';

import CamperSearchResult from './CamperSearchResult';
import CamperEdit from './CamperEdit';

import { useQuery } from 'hooks/navigation';
// import getAllKeys from 'utils/objectKeys';

function EventAdminCampers(props: EventAdminPageProps) {
  const { event } = props;
  const camperLookup = useCamperLookup();
  const camperSearch = useCamperSearch();

  const camperId = useQuery('camperId');
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!camperSearch || !camperLookup) return <Spinner />;

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
