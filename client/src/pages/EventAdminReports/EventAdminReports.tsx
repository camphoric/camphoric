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
import Fuse from 'fuse.js';
import { useQueryLookup } from 'hooks/admin';
import { apiFetch } from 'utils/fetch';
import Modal from 'components/Modal';

import ReportSearchResult from './ReportSearchResult';
import ReportView from './ReportView';
import ReportEditForm, { ReportEditFormValue } from './ReportEditForm';

const reportSearchOptions = {
  isCaseSensitive: true,
  includeScore: true,
  shouldSort: true,
  includeMatches: true,
  // findAllMatches: false,
  location: 0,
  threshold: 0.6,
  distance: 100,
  keys: [
    'template',
    'title',
  ]
}

function EventAdminReports({ event, ...props }: EventAdminPageProps) {
  const [reports, setReports] = React.useState<ApiReport[] | null>(null);
  const [reportSearch, setReportSearch] = React.useState<Fuse<ApiReport> | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const modalRef  = React.useRef<Modal>(null);
  const queryLookup = useQueryLookup();

  const [formValues, setFormValues] = React.useState<ReportEditFormValue>({
    title: '',
    template: '',
  });

  const getReports = async () => {
    try {
      const response = await apiFetch('/api/reports/');
      const json = await response.json();
      const reportSearch = new Fuse<ApiReport>(json, reportSearchOptions);

      setReports(json);
      setReportSearch(reportSearch);
    } catch (error) {
      console.log('error', error);
    }
  };

  const putReports = async (values: ReportEditFormValue) => {
    try {
      if (!reports) return;

      const report = reports.find(r => r.id.toString() === queryLookup['reportId']);

      if (!report) return;

      await apiFetch(`/api/reports/${report.id}/`, 'PUT', {
        ...(report || {}),
        ...values,
      });

      setReports(null);
      getReports();
    } catch (error) {
      console.log('error', error);
    }
  }

  const postReports = async (values: ReportEditFormValue) => {
    try {
      await apiFetch(`/api/reports/`, 'POST', {
        event: event.id,
        ...values,
      });

      setReports(null);
      getReports();
    } catch (error) {
      console.log('error', error);
    }
  }

  React.useEffect(() => {
    getReports();
  }, [event.id]);

  if (!reports) return <Spinner />;
  if (!reportSearch) return <Spinner />;

  const showModal = () => modalRef.current && modalRef.current.show()
  const saveReport = (report?: ApiReport) =>
    async () => {
      if (!report) {
        await postReports(formValues);
      } else {
        await putReports(formValues);
      }

      await getReports();
    };

  const report = reports.find(r => r.id.toString() === queryLookup['reportId']);
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
                templateVars={props}
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
