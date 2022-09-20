import React from 'react';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import ReportEditForm, { ReportEditFormProps, ReportEditFormValue } from './ReportEditForm';
import Template from 'components/Template';

import type { ReportTemplateVars } from './EventAdminReports';

interface Props extends ReportEditFormProps {
  save: () => any;
  result: ApiReport;
  onChange: (a: ReportEditFormValue) => void;
  templateVars: ReportTemplateVars;
}

function ReportTab({ result, templateVars, ...props }: Props) {
  const [activeTab, setActiveTab] = React.useState('View');

  const save = () => {
    props.save();
    setActiveTab('View');
  }

  return (
    <Tabs
      defaultActiveKey="View"
      onSelect={(k) => setActiveTab(k || 'View')}
      activeKey={activeTab}
    >
      <Tab eventKey="View" title="View">
        <Template
          markdown={result.template}
          templateVars={templateVars}
        />
      </Tab>
      <Tab eventKey="Edit" title="Edit">
        <ReportEditForm
          templateVars={templateVars}
          onChange={props.onChange}
          result={result}
        />

        <Button variant="primary" onClick={save}>
          Save Changes
        </Button>
      </Tab>
      <Tab eventKey="Print" title="Print">
        Print {result.title}
        Nothing Here Yet
      </Tab>
    </Tabs>
  );
}

export default ReportTab;
