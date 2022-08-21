import React from 'react';
import {
  InputGroup,
  FormControl,
  Container,
  Row, Col,
  Tab, Tabs,
} from 'react-bootstrap';
import Fuse from 'fuse.js';
import * as fuseUtils from 'utils/fuse';

import {
  useRegistrationLookup,
  useRegistrationSearch,
  useEvent,
} from 'hooks/api';

import { useQuery } from 'hooks/navigation';
import Spinner from 'components/Spinner';

import RegistrationSearchResult from './RegistrationSearchResult';
import RegistrationEdit from './RegistrationEdit';

import PaymentTab from './PaymentTab';

const camperLabel = (c: ApiCamper) => {
  if (!c) return '';

  return `${c.attributes.first_name} ${c.attributes.last_name}`
}

function EditTab() {
  const eventApi = useEvent();
  const registrationLookup = useRegistrationLookup();
  const registrationSearch = useRegistrationSearch();

  const registrationId = useQuery('registrationId');
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!registrationSearch || !registrationLookup) return <Spinner />;
  if (eventApi.isLoading || !eventApi.data) return <Spinner />;

  const event = eventApi.data;

  let results;
  if (searchQuery.length) {
    results = registrationSearch.search(searchQuery);
  } else {
    results = fuseUtils.getFirstNOf(registrationSearch, 10);
  }

  const selectedRegistration = registrationLookup[registrationId];

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
                  resultLabel={camperLabel(r.item.campers[0])}
                  selected={r.item.id.toString() === registrationId}
                />
                )
            )
          }
        </Col>
        <Col md="9">
          {
            !!selectedRegistration && (
              <Tabs defaultActiveKey="reg_edit_edit">
                <Tab eventKey="reg_edit_edit" title={camperLabel(selectedRegistration && selectedRegistration.campers[0])}>
                  <RegistrationEdit
                    event={event}
                    registration={selectedRegistration}
                  />
                </Tab>
                <Tab eventKey="reg_edit_payments" title="Payments">
                  <PaymentTab
                    event={event}
                    registration={selectedRegistration}
                  />
                </Tab>
              </Tabs>
            )
          }
        </Col>
      </Row>
    </Container>
  );
}

export default EditTab;
