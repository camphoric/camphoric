import React from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import Spinner from 'components/Spinner';
import EmailEditForm from './EmailEditForm';
import { useQueryLookup } from 'hooks/navigation';

function ReportTab() {
  const [activeTab, setActiveTab] = React.useState('View');

  const queryLookup = useQueryLookup();

  if (!queryLookup) return <Spinner />;

  // const reportId = queryLookup.reportId;
  // const report = reportLookup[reportId];

  // if (!report) return null;

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
          <div>View Email</div>
        </Tab>
        <Tab eventKey="Edit" title="Edit">
          <EmailEditForm
            email={undefined}
            setActiveTab={setActiveTab}
          />
        </Tab>
      </Tabs>
    </>
  );
}

export default ReportTab;
