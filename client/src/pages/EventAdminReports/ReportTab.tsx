import React from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import Spinner from 'components/Spinner';
import ReportEditForm, { ReportEditFormProps, ReportEditFormValue } from './ReportEditForm';
import Template, { ReportTemplateVars } from 'components/Template';
import ConfirmDialog from 'components/Modal/ConfirmDialog';
import api, { useReportLookup } from 'hooks/api';
import { useQueryLookup } from 'hooks/navigation';

import RenderedReport from './RenderedReport';

function ReportTab() {
  const [activeTab, setActiveTab] = React.useState('View');

  const reportLookup = useReportLookup();
  const queryLookup = useQueryLookup();

  if (!queryLookup || !reportLookup) return <Spinner />;

  const reportId = queryLookup.reportId;
  const report = reportLookup[reportId];

  if (!report) return null;

  return (
    <>
      <Tabs
        defaultActiveKey="View"
        onSelect={(k) => setActiveTab(k || 'View')}
        activeKey={activeTab}
      >
        <Tab eventKey="View" title="View">
          <RenderedReport report={report} />
        </Tab>
        <Tab eventKey="Edit" title="Edit">
          <ReportEditForm
            report={report}
            setActiveTab={setActiveTab}
          />

        </Tab>
        <Tab eventKey="Print" title="Print">
          Print {report.title}
          Nothing Here Yet
        </Tab>
      </Tabs>
    </>
  );
}

export default ReportTab;
