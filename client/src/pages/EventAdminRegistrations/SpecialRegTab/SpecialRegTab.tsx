// TODO: refactor using hooks/api for api calls

import React from 'react';
import {
  Container,
  Row,
  Col,
} from 'react-bootstrap';
import { apiFetch } from 'utils/fetch';
import Spinner from 'components/Spinner';
import debug from 'utils/debug';
import {
  useEvent,
} from 'hooks/api';

import ControlColumn from './ControlColumn';
import InvitationReport from './InvitationReport';
import { InvitePostValues } from './InviteModal';
import { RegTypePostValues } from './RegTypeModal';

function SpecialRegTab() {
  const eventApi = useEvent();
  const [registrationTypes, setRegistrationTypes] = React.useState<ApiRegistrationType[] | null>(null);
  const [invitations, setInvitations] = React.useState<ApiInvitation[] | null>(null);
  const [fetching, setFetching] = React.useState<boolean>(true);

  const eventId = eventApi?.data?.id;

  const getValues = async () => {
    setFetching(true);
    try {
      const filterByEvent = async (url: string) => {
        const res = await apiFetch(url);
        const vals = await res.json();

        return vals.filter((v: { event: number }) => v.event === eventId);
      };

      const [regTypeResponse, invitationResponse] = await Promise.all([
        filterByEvent('/api/registrationtypes/'),
        apiFetch('/api/invitations/').then(r => r.json()),
      ]);

      debug('SpecialRegTab getValues', regTypeResponse, invitationResponse);

      setRegistrationTypes(regTypeResponse || []);
      setInvitations(invitationResponse || []);
    } catch (error) {
      console.error('error', error);
    } finally {
      setFetching(false);
    }
  };

  const newInvitation = async (values: InvitePostValues) => {
    if (!eventId) return;

    setFetching(true);
    try {
      const inv = await apiFetch('/api/invitations/', 'POST', {
        event: eventId,
        ...values
      }).then(r => r.json()) as ApiInvitation;

      debug('newInvitation', inv);
      await apiFetch(`/api/invitations/${inv.id}/send`, 'POST', {
        event: eventId,
        ...values
      });
    } catch (error) {
      console.error('error /api/invitations/ POST', error);
    } finally {
      await getValues();
      setFetching(false);
    }
  }

  const newRegType = async (values: RegTypePostValues) => {
    if (!eventId) return;

    setFetching(true);
    const method = values.id ? 'PUT' : 'POST';
    let url = '/api/registrationtypes/';

    try {
      if (values.id) {
        url = `${url}${values.id}/`;
      }

      await apiFetch(url, method, {
        event: eventId,
        ...values
      });
    } catch (error) {
      console.error(`error ${url} ${method}`, error);
    } finally {
      await getValues();
      setFetching(false);
    }
  }

  const deleteRegType = async (id: string | number) => {
    setFetching(true);
    try{
      await apiFetch(`/api/registrationtypes/${id}`, 'DELETE');
    } catch (error) {
      console.error('error /api/registrationtypes/ POST', error);
    } finally {
      await getValues();
      setFetching(false);
    }
  }

  React.useEffect(() => {
    getValues();
  }, [eventId]); // eslint-disable-line

  if (fetching || !registrationTypes || !invitations) return <Spinner />;
  if (!eventApi.data) return <Spinner />;

  return (
    <Container className="special-registration">
      <Row>
        <Col md={3}>
          <ControlColumn
            registrationTypes={registrationTypes}
            newInvitation={newInvitation}
            newRegType={newRegType}
            deleteRegType={deleteRegType}
          />
        </Col>
        <Col md={9}>
          <InvitationReport invitations={invitations} />
        </Col>
      </Row>
    </Container>
  );
}

export default SpecialRegTab;
