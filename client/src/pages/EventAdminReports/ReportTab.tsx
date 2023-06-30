import React from 'react';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import ReportEditForm, { ReportEditFormProps, ReportEditFormValue } from './ReportEditForm';
import Template, { ReportTemplateVars } from 'components/Template';
import ConfirmDialog from 'components/Modal/ConfirmDialog';

interface Props extends ReportEditFormProps {
  save: () => any;
  remove: () => any;
  result: ApiReport;
  onChange: (a: ReportEditFormValue) => void;
  templateVars: ReportTemplateVars;
}

function ReportTab({ result, templateVars, ...props }: Props) {
  const deleteModal  = React.useRef<ConfirmDialog>(null);
  const [activeTab, setActiveTab] = React.useState('View');

  const save = () => {
    props.save();
    setActiveTab('View');
  }

  return (
    <>
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

        <div className="button-container">
          <Button variant="primary" onClick={save}>
            Save Changes
          </Button>

          <Button variant="danger" onClick={() => deleteModal.current?.show()}>
            Delete Report
          </Button>
        </div>
        </Tab>
        <Tab eventKey="Print" title="Print">
          Print {result.title}
          Nothing Here Yet
        </Tab>
      </Tabs>
      <ConfirmDialog
        ref={deleteModal}
        title={`Delete report "${result.title}"?`}
        onConfirm={props.remove}
      />
    </>
  );
}

export default ReportTab;
