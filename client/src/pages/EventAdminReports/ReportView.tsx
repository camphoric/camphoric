import React from 'react';
import Spinner from 'components/Spinner';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import ReportEditForm, { ReportEditFormProps } from './ReportEditForm';
import Template from 'components/Template';

interface Props extends ReportEditFormProps {
  save: () => any;
  templateVars?: {};
}

function ReportView({ result, ...props }: Props) {
  if (!result) return <Spinner />;

  return (
    <Tabs defaultActiveKey="View">
      <Tab eventKey="View" title="View">
        <Template
          markdown={result.template}
          templateVars={props.templateVars}
        />
      </Tab>
      <Tab eventKey="Edit" title="Edit">
        <ReportEditForm
          onChange={props.onChange}
          result={result}
        />

        <Button variant="primary" onClick={props.save}>
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

export default ReportView;
