import React from 'react';
import moment from 'moment';
import {
  Alert,
  Button,
} from 'react-bootstrap';
import Spinner from 'components/Spinner';
import { 
  JSONSchema7,
} from 'json-schema';
import JsonSchemaForm, {
  JsonSchemaFormChangeEvent,
} from 'components/JsonSchemaForm/AdminEdit';
import api, { useLodgingLookup} from 'hooks/api';
import { getDaysArray } from '../../EventAdminLodging/utils';

type FormData = {
  [key: string]: any;
};

interface Props {
  event: ApiEvent;
  camper: ApiCamper;
}

const formatDate = (date: Date) => {
  return moment(date).utcOffset(0).format('dd MM/D').toString();
}

const formatDateKey = (date: Date) => {
  return moment(date).utcOffset(0).format('YYYY-MM-DD');
}

type CamperFormData = {
  [s: string]: boolean,
};

const createInitialCamperData = (stay: Array<string> = []) => {
  if (!stay) return {};

  return stay.reduce((acc: CamperFormData,
    d: string) => ({
      ...acc,
      [d]: true,
    }), {} as CamperFormData)
}

function LodgingTab({ event, camper }: Props) {
  const lodgingLookup = useLodgingLookup();
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>();
  const [patchCamper] = api.useUpdateCamperMutation();
  const [formData, setFormData] = React.useState<CamperFormData>(createInitialCamperData(camper.stay));
  const [camperId, setCamperId] = React.useState(camper.id);

  React.useEffect(() => {
    if (camperId.toString() !== camper.id.toString() && camper) {
      setCamperId(camper.id);
      setFormData(createInitialCamperData(camper?.stay));
    }
  }, [camperId, formData, camper]);

  if (loading) return <Spinner />;

  const onDataChange = (evt: JsonSchemaFormChangeEvent<FormData>) => {
    setFormData(evt.formData);
  }

  const save = async () => {
    setLoading(true);

    const res = await patchCamper({
      id: camper.id,
      stay: Object.keys(formData).filter(k => formData[k]),
    });

    setLoading(false);

    if ('error' in res) {
      setError(res.error);

      return;
    }

    setError(undefined);
  }

  const days = (getDaysArray(event) || []).slice(0, -1);
  const schemas: { dataSchema: JSONSchema7, uiSchema: { order: Array<string> } } = days.reduce((acc, d) => {
    return {
      dataSchema: {
        ...acc.dataSchema,
        type: 'object',
        properties: {
          ...acc.dataSchema.properties,
          [formatDateKey(d)]: {
            type: 'boolean',
            title: formatDate(d) || '?',
            default: false,
          },
        },
      },
      uiSchema: {
        ...acc.uiSchema,
      },
    };
  }, {
    dataSchema: { type: 'object', properties: {} } as JSONSchema7,
    uiSchema: { order: [] },
  });

  schemas.uiSchema.order = getDaysArray(event).map(formatDateKey);

  const lodgingAssignment = 
    lodgingLookup && camper.lodging ? lodgingLookup[camper.lodging]?.fullPath : 'Unassigned';

  return (
    <>
      Camper Lodging Assignment: {lodgingAssignment}
      {
        !!error && (
          <Alert variant="danger">{error}</Alert>
        )
      }
      <JsonSchemaForm
        schema={schemas.dataSchema}
        uiSchema={schemas.uiSchema}
        formData={formData}
        onChange={onDataChange}
        templateData={{ }}
      />

      <Button onClick={save}>Save</Button>
    </>
  );
}

export default LodgingTab;
