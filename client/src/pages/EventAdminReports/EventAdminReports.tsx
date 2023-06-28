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
import { ReportTemplateVars } from 'components/Template';

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
import ReportEditForm, { ReportEditFormValue } from './ReportEditForm';

const blankForm = {
  title: '',
  template: '',
};

function EventAdminReports() {
  const reportSearch = useReportSearch();
  const reportLookup = useReportLookup();
  const { data: reports } = api.useGetReportsQuery();
  const [updateReport] = api.useUpdateReportMutation();
  const [createReport] = api.useCreateReportMutation();
  const { data: event } = useEvent();
  const registrationLookup = useRegistrationLookup();
  const camperLookup = useCamperLookup();
  const lodgingLookup = useLodgingLookup();

  const [searchQuery, setSearchQuery] = React.useState('');
  const modalRef  = React.useRef<Modal>(null);
  const queryLookup = useQueryLookup();

  const [formValues, setFormValues] = React.useState<ReportEditFormValue>(blankForm);

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
  const saveReport = (report?: ApiReport) =>
    async () => {
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

      setFormValues(blankForm);
    };

  const report = reportLookup[queryLookup['reportId']];
  const searchResults = searchQuery
    ? reportSearch.search(searchQuery).map(c => c.item)
    : Object.values(reportLookup);

  const registrations = Object.values(registrationLookup);
  const campers = Object.values(camperLookup);

  const templateVars: ReportTemplateVars = {
    event,
    registrationLookup,
    lodgingLookup,
    camperLookup,
    registrations,
    campers,
  };

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
              <ReportTab
                templateVars={templateVars}
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
        onSave={saveReport()}
      >
        <ReportEditForm
          templateVars={templateVars}
          onChange={setFormValues}
          newReport
        />
      </Modal>
    </Container>
  );
}

export default EventAdminReports;
