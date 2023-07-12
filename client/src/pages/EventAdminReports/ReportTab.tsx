import React from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import Spinner from 'components/Spinner';
import ReportEditForm from './ReportEditForm';
import { useReportLookup } from 'hooks/api';
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
        mountOnEnter
        unmountOnExit
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
      </Tabs>
    </>
  );
}

export default ReportTab;
