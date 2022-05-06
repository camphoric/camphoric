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

import {
  useReportLookup,
  useReportSearch,
  useEvent,
} from 'store/hooks';
import api from 'store/api';

import ReportSearchResult from './ReportSearchResult';
import ReportView from './ReportView';
import ReportEditForm, { ReportEditFormValue } from './ReportEditForm';

function EventAdminReports() {
  const reportSearch = useReportSearch();
  const reportLookup = useReportLookup();
  const { data: reports } = api.useGetReportsQuery();
  const [updateReport] = api.useUpdateReportMutation();
  const [createReport] = api.useCreateReportMutation();
  const { data: event } = useEvent();

  const [searchQuery, setSearchQuery] = React.useState('');
  const modalRef  = React.useRef<Modal>(null);
  const queryLookup = useQueryLookup();

  const [formValues, setFormValues] = React.useState<ReportEditFormValue>({
    title: '',
    template: '',
  });

  if (
    !event ||
    !reports ||
    !reportSearch ||
    !reportLookup
  ) {
    return <Spinner />;
  }

  const showModal = () => modalRef.current && modalRef.current.show()
  const saveReport = (report?: ApiReport) =>
    async () => {
      console.log('saveReport', report, formValues);

      if (!report) {
        await createReport({
          event: event.id,
          ...formValues,
        });
      } else {
        await updateReport({
          id: report.id,
          ...formValues
        });
      }
    };

  const report = reportLookup[queryLookup['reportId']];
  console.log('report', report, formValues);
  const searchResults = searchQuery
    ? reportSearch.search(searchQuery).map(c => c.item)
    : reports;

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
            searchResults.map(
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
        <Col md="9">
          {
            !!report && (
              <ReportView
                onChange={setFormValues}
                result={report}
                save={saveReport(report)}
              />
            )
          }
        </Col>
      </Row>
      <Modal
        ref={modalRef}
        title="New report"
        saveButtonLabel="Create"
        handleSave={saveReport()}
      >
        <ReportEditForm onChange={setFormValues} />
      </Modal>
    </Container>
  );
}

export default EventAdminReports;
