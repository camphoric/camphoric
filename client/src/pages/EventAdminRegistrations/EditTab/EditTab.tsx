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
  useRegistrationLookup,
  useRegistrationSearch,
} from 'store/hooks';

import { useQuery } from 'hooks/admin';
import Spinner from 'components/Spinner';

import RegistrationSearchResult from './RegistrationSearchResult';
import RegistrationEdit from './RegistrationEdit';

function EditTab(props: EventAdminPageProps) {
  const { event } = props;
  const registrationLookup = useRegistrationLookup();
  const registrationSearch = useRegistrationSearch();

  const registrationId = useQuery('registrationId');
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!registrationSearch || !registrationLookup) return <Spinner />;

  let results;
  if (searchQuery.length) {
    results = registrationSearch.search(searchQuery);
  } else {
    results = fuseUtils.getFirstNOf(registrationSearch, 10);
  }

  return (
    <Container className="registration-edit">
      <Row>
        <Col md={3} className="registration-results">
          <InputGroup className="mb-3 control-buttons">
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

export default EditTab;
