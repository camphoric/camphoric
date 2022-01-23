import React from 'react';
import {
  Tabs, Tab,
} from 'react-bootstrap';

import EditTab from './EditTab';
import SpecialRegTab from './SpecialRegTab';

function EventAdminRegistrations(props: EventAdminPageProps) {
  return (
    <Tabs defaultActiveKey="reg_edit">
      <Tab eventKey="reg_edit" title="Edit">
        <EditTab {...props} />
      </Tab>
      <Tab eventKey="reg_special" title="Special Registrations">
        <SpecialRegTab {...props} />
      </Tab>

    </Tabs>
  );
}

export default EventAdminRegistrations;
