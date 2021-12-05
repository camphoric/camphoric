import React from 'react';

import { Tabs, Tab } from 'react-bootstrap';
import { useEvent } from 'hooks/admin';
import Spinner from 'components/Spinner';
import { formatDateTimeForApi } from 'utils/time';

import EditBasicTab from './EditBasicTab';
import EditSchemaTab from './EditSchemaTab';

export interface TabProps {
  handleFormChange: (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => any;
  handleFormDateChange: (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => any;
  handleChange: (field: string) => (value: any) => any;
  event: ApiEvent;
  save: () => any;
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

function EventAdminHome({ event: originalEvent }: EventAdminPageProps) {
  const [event, setEvent] = React.useState<ApiEvent>(originalEvent);
  const { set: apiPutEvent } = useEvent(originalEvent.id);

  if (!originalEvent) return <Spinner />;

  // console.log(event);

  const handleFormChange = (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => setEvent({
    ...event,
    [field]: changeEvent.target.value,
  });

  const handleFormDateChange = (field: string) => (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = changeEvent.target;
    const dateValue = formatDateTimeForApi(value);

    // console.log(dateValue);

    setEvent({
      ...event,
      [field]: dateValue,
    });
  }

  const handleChange = (field: string) => (value: any) => setEvent({
    ...event,
    [field]: value,
  });

  const save = () => apiPutEvent(event);

  const tabProps: TabProps = {
    handleFormChange,
    handleFormDateChange,
    handleChange,
    event,
    save,
  };

  return (
    <Tabs defaultActiveKey="basic">
      <Tab eventKey="basic" title="Event Info">
        <EditBasicTab {...tabProps} />
      </Tab>
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
    </Tabs>
  );
}

export default EventAdminHome;
