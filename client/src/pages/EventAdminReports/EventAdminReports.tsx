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
import Modal from 'components/Modal';
import { sortStringCompare } from 'utils/sort';

import api, {
  useCamperLookup,
  useEvent,
  useLodgingLookup,
  useRegistrationLookup,
  useReportLookup,
  useReportSearch,
} from 'hooks/api';

import ReportSearchResult from './ReportSearchResult';
import ReportTab from './ReportTab';
import ReportEditForm from './ReportEditForm';

const sortByReportName = (a: ApiReport, b: ApiReport) =>
  sortStringCompare(a.title, b.title);

function EventAdminReports() {
  const reportSearch = useReportSearch();
  const reportLookup = useReportLookup();
  const { data: reports } = api.useGetReportsQuery();
  const { data: event } = useEvent();
  const registrationLookup = useRegistrationLookup();
  const camperLookup = useCamperLookup();
  const lodgingLookup = useLodgingLookup();

  const [searchQuery, setSearchQuery] = React.useState('');
  const modalRef  = React.useRef<Modal>(null);
  const queryLookup = useQueryLookup();

  if (
    !event ||
    !reports ||
    !camperLookup ||
    !reportSearch ||
    !reportLookup ||
    !registrationLookup ||
    !lodgingLookup
  ) {
    return <Spinner />;
  }

  const showModal = () => modalRef.current && modalRef.current.show()

  const report = reportLookup[queryLookup['reportId']];

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
            searchResults.sort(sortByReportName).map(
              (c: ApiReport) => (
                <ReportSearchResult
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
          <ReportTab />
        </Col>
      </Row>
      <Modal
        ref={modalRef}
        title="New report"
        saveButtonLabel="Create"
      >
        <ReportEditForm newReport modalRef={modalRef} />
      </Modal>
    </Container>
  );
}

export default EventAdminReports;
