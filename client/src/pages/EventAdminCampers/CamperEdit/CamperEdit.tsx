import React from 'react';
import {
  Tabs, Tab,
} from 'react-bootstrap';

import EditTab from './EditTab';
import AdminAttributes from './AdminAttributes';

interface Props {
  camper: ApiCamper;
  event: ApiEvent,
}

const camperLabel = (c: ApiCamper) => {
  if (!c) return '';

  return `${c.attributes.first_name} ${c.attributes.last_name}`
}

function CamperEdit(props: Props) {
  return (
    <Tabs>
      <Tab eventKey="camper_edit" title={camperLabel(props.camper)}>
        <EditTab {...props} />
      </Tab>
      <Tab eventKey="camper_admin_attrs" title="Admin Attributes">
        <AdminAttributes {...props} />
      </Tab>

    </Tabs>
  );
}

export default CamperEdit;
