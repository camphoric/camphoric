import React from 'react';
import Spinner from 'components/Spinner';
import {
  Button,
  Tabs,
  Tab,
} from 'react-bootstrap';
import ReportEditForm, { ReportEditFormProps, ReportEditFormValue } from './ReportEditForm';
import Template from 'components/Template';

import {
  useEvent,
  useRegistrationLookup,
  useCamperLookup,
  useLodgingLookup,
  RegistrationLookup,
  CamperLookup,
  LodgingLookup,
} from 'hooks/api';

interface Props extends ReportEditFormProps {
  save: () => any;
  result: ApiReport;
  onChange: (a: ReportEditFormValue) => void;
}

interface ReportTemplateVars {
  event: ApiEvent;
  registrationLookup: RegistrationLookup | undefined;
  registrations: Array<AugmentedRegistration>;
  camperLookup: CamperLookup | undefined;
  lodgingLookup: LodgingLookup | undefined,
  campers: Array<ApiCamper>;
}

function ReportView({ result, ...props }: Props) {
  const event = useEvent();
  const registrationLookup = useRegistrationLookup();
  const camperLookup = useCamperLookup();
  const lodgingLookup = useLodgingLookup();
  const [activeTab, setActiveTab] = React.useState('View');

  if (
    !result ||
    !event.data ||
    !camperLookup ||
    !registrationLookup ||
    !lodgingLookup
  ) {
    return <Spinner />;
  }

  const registrations = Object.values(registrationLookup);
  const campers = Object.values(camperLookup);

  const templateVars: ReportTemplateVars = {
    event: event.data,
    registrationLookup,
    lodgingLookup,
    camperLookup,
    registrations,
    campers,
  };

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

export default ReportView;
