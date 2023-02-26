import React from 'react';
import {
  Tabs, Tab,
} from 'react-bootstrap';
import { useHistory } from 'react-router-dom';

import EditTab from './EditTab';
import SpecialRegTab from './SpecialRegTab';

function EventAdminRegistrations() {
  const history = useHistory();
  const params = new URLSearchParams(history.location.search);
  const activeTab = params.get('registrationsTab');

  const setTab = (tab: string | null) => {
    if (!tab) return;
    params.set('registrationsTab', tab);
    history.replace({
      ...history.location,
      search: `?${params.toString()}`,
    });
  };

  return (
    <Tabs activeKey={activeTab || 'reg_edit'} onSelect={setTab}>
      <Tab eventKey="reg_edit" title="Edit">
        <EditTab />
      </Tab>
      <Tab eventKey="reg_special" title="Special Registrations">
        <SpecialRegTab />
      </Tab>

    </Tabs>
  );
}

export default EventAdminRegistrations;
