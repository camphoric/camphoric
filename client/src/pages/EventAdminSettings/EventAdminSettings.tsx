import React from 'react';

import { Tabs, Tab } from 'react-bootstrap';
import { useEvent } from 'store/hooks';
import Spinner from 'components/Spinner';

import EditSchemaTab from './EditSchemaTab';
import EditRegistrationTypes from './EditRegistrationTypes';

export interface TabProps {
  event: ApiEvent;
}

type EditableSchemaConfig = {
  order: number,
  title: string,
}

export const editableSchemas = {
  camper_schema:              { order: 1, title: 'Camper' },
  registration_schema:        { order: 2, title: 'Registration' },
  registration_ui_schema:     { order: 3, title: 'Form UI' },
  camper_pricing_logic:       { order: 4, title: 'Camper Pricing' },
  registration_pricing_logic: { order: 5, title: 'Reg Pricing' },
  deposit_schema:             { order: 6, title: 'Deposits' },
  payment_schema:             { order: 7, title: 'Payment' },
}

export type EditableSchemaKeys = keyof typeof editableSchemas;

function EventAdminHome() {
  const eventApi = useEvent();

  if (eventApi.isLoading || !eventApi.data) return <Spinner />;

  const tabProps: TabProps = {
    event: eventApi.data,
  };

  return (
    <Tabs defaultActiveKey="camper_schema">
      {
        (Object.keys(editableSchemas) as Array<EditableSchemaKeys>)
          .sort((a, b) => editableSchemas[a].order - editableSchemas[b].order)
          .map((schemaName) => {
            const schema = editableSchemas[schemaName] as EditableSchemaConfig;

            return (
              <Tab key={schemaName} eventKey={schemaName} title={schema.title}>
                <EditSchemaTab
                  {...tabProps}
                  name={schemaName}
                />
              </Tab>
            );
          })
      }
      <Tab key="registrationTypes" eventKey="registrationTypes" title="Registration Types">
        <EditRegistrationTypes {...tabProps} />
      </Tab>
    </Tabs>
  );
}

export default EventAdminHome;
