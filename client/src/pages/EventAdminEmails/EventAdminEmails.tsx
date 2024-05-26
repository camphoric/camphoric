import React from 'react';
import Spinner from 'components/Spinner';
import {
  InputGroup,
  FormControl,
  Container,
  Row,
  Col,
  Button,
} from 'react-bootstrap';
import { useQueryLookup } from 'hooks/navigation';
import { sortStringCompare } from 'utils/sort';

import {
  useReportLookup,
  useReportSearch,
} from 'hooks/api';

import EmailSearchResult from './EmailSearchResult';
import EmailTab from './EmailTab';
import EmailEditForm from './EmailEditForm';

const sortByEmailName = (a: ApiReport, b: ApiReport) =>
  sortStringCompare(a.title, b.title);

function EventAdminEmails() {
  const reportSearch = useReportSearch();
  const reportLookup = useReportLookup();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [showNewEmailForm, setShowNewEmailForm] = React.useState<boolean>(false);
  const queryLookup = useQueryLookup();

  if (!reportSearch || !reportLookup) return <Spinner />;

  const showModal = () => setShowNewEmailForm(true);

  const searchResults = searchQuery
    ? reportSearch.search(searchQuery).map(c => c.item)
    : Object.values(reportLookup);

  return (
    <Container className="reports-container">
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
            searchResults.sort(sortByEmailName).map(
              (c: ApiReport) => (
                <EmailSearchResult
                  key={c.id}
                  result={c}
                  selected={c.id.toString() === queryLookup['reportId']}
                />
              )
            )
          }
          <Button onClick={showModal}>Add New</Button>
        </Col>
        <Col md="9" className="report-tabs">
          <EmailTab />
        </Col>
      </Row>
      <EmailEditForm
        newEmail
        setShowModal={setShowNewEmailForm}
        showModal={showNewEmailForm}
      />
    </Container>
  );
}

export default EventAdminEmails;
